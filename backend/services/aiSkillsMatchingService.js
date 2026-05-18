/**
 * AI-Powered Skills Matching Service
 * 
 * Uses Voyage AI embeddings for semantic skill matching.
 * Works for ANY industry - tech, healthcare, finance, creative, etc.
 * No hardcoded mappings - understands context and relationships.
 */

const { embeddingService } = require('./embeddingService');
const { LRUCache } = require('../utils/aiUtils');

// LRU cache for skill embeddings
const embeddingCache = new LRUCache(10000);

class AISkillsMatchingService {
  constructor() {
    this.model = 'voyage-3-lite'; // Voyage AI model
    this.dimensions = 512;
  }

  /**
   * Get embedding for a single skill/text
   * @param {string} text - Skill or text to embed
   * @returns {Promise<number[]>} - Embedding vector
   */
  async getEmbedding(text) {
    const normalized = text.toLowerCase().trim();
    
    // Check cache first
    if (embeddingCache.has(normalized)) {
      return embeddingCache.get(normalized);
    }

    try {
      const embedding = await embeddingService.getSkillEmbedding(normalized);

      if (!embedding) throw new Error('No embedding returned');
      
      // Cache the result (LRU handles eviction)
      embeddingCache.set(normalized, embedding);
      
      return embedding;
    } catch (error) {
      console.error('Error getting embedding:', error.message);
      throw error;
    }
  }

  /**
   * Get embeddings for multiple skills in batch (more efficient)
   * @param {string[]} texts - Array of skills/texts
   * @returns {Promise<Map<string, number[]>>} - Map of text to embedding
   */
  async getBatchEmbeddings(texts) {
    const results = new Map();
    const uncached = [];
    
    // Check cache first
    for (const text of texts) {
      const normalized = text.toLowerCase().trim();
      if (embeddingCache.has(normalized)) {
        results.set(normalized, embeddingCache.get(normalized));
      } else {
        uncached.push(normalized);
      }
    }

    // Batch request for uncached via Voyage AI
    if (uncached.length > 0) {
      try {
        const batchResults = await embeddingService.getBatchSkillEmbeddings(uncached);
        
        for (const [text, embedding] of batchResults.entries()) {
          // Cache (LRU handles eviction)
          embeddingCache.set(text, embedding);
          results.set(text, embedding);
        }
      } catch (error) {
        console.error('Error getting batch embeddings:', error.message);
        throw error;
      }
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} vecA - First vector
   * @param {number[]} vecB - Second vector
   * @returns {number} - Similarity score (0 to 1)
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find the best matching candidate skill for a job skill
   * @param {string} jobSkill - Required job skill
   * @param {string[]} candidateSkills - Candidate's skills
   * @param {Map<string, number[]>} embeddings - Pre-computed embeddings
   * @returns {object} - { match, similarity }
   */
  findBestMatch(jobSkill, candidateSkills, embeddings) {
    const jobNorm = jobSkill.toLowerCase().trim();
    const jobEmbed = embeddings.get(jobNorm);
    
    if (!jobEmbed) return { match: null, similarity: 0 };

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const candSkill of candidateSkills) {
      const candNorm = candSkill.toLowerCase().trim();
      const candEmbed = embeddings.get(candNorm);
      
      if (!candEmbed) continue;
      
      const similarity = this.cosineSimilarity(jobEmbed, candEmbed);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = candSkill;
      }
    }

    return { match: bestMatch, similarity: bestSimilarity };
  }

  /**
   * Calculate semantic skill match score between job and candidate
   * 
   * @param {string[]} jobSkills - Required job skills
   * @param {string[]} candidateSkills - Candidate's skills
   * @param {object} options - Scoring options
   * @returns {Promise<object>} - { score, matches, missing, bonus, details }
   */
  async calculateSkillMatch(jobSkills, candidateSkills, options = {}) {
    const {
      maxScore = 100,
      exactMatchThreshold = 0.92,    // Consider exact match if similarity >= 0.92
      goodMatchThreshold = 0.75,     // Consider good match if >= 0.75
      partialMatchThreshold = 0.60,  // Consider partial match if >= 0.60
    } = options;

    // Handle empty inputs
    if (!jobSkills || jobSkills.length === 0) {
      return { 
        score: 0, 
        matches: [], 
        missing: [], 
        bonus: candidateSkills || [],
        details: []
      };
    }

    if (!candidateSkills || candidateSkills.length === 0) {
      return { 
        score: 0, 
        matches: [], 
        missing: jobSkills,
        bonus: [],
        details: jobSkills.map(s => ({ jobSkill: s, match: null, similarity: 0 }))
      };
    }

    // Get all embeddings in batch (efficient)
    const allSkills = [...new Set([
      ...jobSkills.map(s => s.toLowerCase().trim()),
      ...candidateSkills.map(s => s.toLowerCase().trim())
    ])];
    
    const embeddings = await this.getBatchEmbeddings(allSkills);

    // Calculate matches for each job skill
    const matches = [];
    const missing = [];
    const details = [];
    let totalScore = 0;

    for (const jobSkill of jobSkills) {
      const { match, similarity } = this.findBestMatch(jobSkill, candidateSkills, embeddings);
      
      const detail = {
        jobSkill,
        match,
        similarity: Math.round(similarity * 100) / 100,
        matchType: 'none'
      };

      if (similarity >= exactMatchThreshold) {
        matches.push({ jobSkill, candidateSkill: match, type: 'exact', similarity });
        totalScore += 1.0;
        detail.matchType = 'exact';
      } else if (similarity >= goodMatchThreshold) {
        matches.push({ jobSkill, candidateSkill: match, type: 'good', similarity });
        totalScore += 0.75;
        detail.matchType = 'good';
      } else if (similarity >= partialMatchThreshold) {
        matches.push({ jobSkill, candidateSkill: match, type: 'partial', similarity });
        totalScore += 0.4;
        detail.matchType = 'partial';
      } else {
        missing.push(jobSkill);
      }

      details.push(detail);
    }

    // Calculate bonus for extra relevant skills
    const matchedCandidateSkills = matches.map(m => m.candidateSkill?.toLowerCase().trim());
    const bonus = candidateSkills.filter(s => 
      !matchedCandidateSkills.includes(s.toLowerCase().trim())
    );

    // Final score (0-100)
    const rawScore = jobSkills.length > 0 ? (totalScore / jobSkills.length) * maxScore : 0;
    const score = Math.round(rawScore);

    return {
      score,
      matches,
      missing,
      bonus,
      details,
      summary: {
        required: jobSkills.length,
        exact: matches.filter(m => m.type === 'exact').length,
        good: matches.filter(m => m.type === 'good').length,
        partial: matches.filter(m => m.type === 'partial').length,
        missing: missing.length
      }
    };
  }

  /**
   * Extract skills from a profile object
   * @param {object} profileSkills - Skills object (array or categorized object)
   * @returns {string[]} - Flat array of skill names
   */
  extractFromProfile(profileSkills) {
    if (!profileSkills) return [];
    
    const skills = [];
    
    if (Array.isArray(profileSkills)) {
      profileSkills.forEach(skill => {
        if (typeof skill === 'string') {
          skills.push(skill);
        } else if (skill && skill.name) {
          skills.push(skill.name);
        }
      });
    } else if (typeof profileSkills === 'object') {
      Object.values(profileSkills).forEach(categorySkills => {
        if (Array.isArray(categorySkills)) {
          categorySkills.forEach(skill => {
            if (typeof skill === 'string') {
              skills.push(skill);
            } else if (skill && skill.name) {
              skills.push(skill.name);
            }
          });
        }
      });
    }
    
    return skills;
  }

  /**
   * Quick similarity check between two skill strings
   * @param {string} skill1 - First skill
   * @param {string} skill2 - Second skill
   * @returns {Promise<number>} - Similarity (0 to 1)
   */
  async compareTwoSkills(skill1, skill2) {
    const embeddings = await this.getBatchEmbeddings([skill1, skill2]);
    const embed1 = embeddings.get(skill1.toLowerCase().trim());
    const embed2 = embeddings.get(skill2.toLowerCase().trim());
    
    if (!embed1 || !embed2) return 0;
    return this.cosineSimilarity(embed1, embed2);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: embeddingCache.size,
      maxSize: embeddingCache.maxSize || 10000
    };
  }

  /**
   * Clear the embedding cache
   */
  clearCache() {
    embeddingCache.clear();
  }
}

// Export singleton instance
const aiSkillsMatching = new AISkillsMatchingService();

module.exports = {
  aiSkillsMatching,
  AISkillsMatchingService
};
