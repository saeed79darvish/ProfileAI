/**
 * Voyage AI Embedding Service for RAG-powered Smart Search
 * 
 * Uses Voyage AI voyage-3-lite (512 dimensions) for embedding generation.
 * Embeddings are stored in PostgreSQL via pgvector for fast similarity search.
 * 
 * Supports asymmetric retrieval: documents and queries use different input_type
 * for optimal RAG performance (Anthropic-recommended partner).
 */

const { VoyageAIClient } = require('voyageai');
const sequelize = require('../config/database');
const { LRUCache } = require('../utils/aiUtils');

// Initialize Voyage AI client
const voyageClient = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY
});

// Config
const EMBEDDING_MODEL = 'voyage-3-lite';
const EMBEDDING_DIMENSIONS = 512;
const MAX_BATCH_SIZE = 128; // Voyage AI batch limit

// LRU query embedding cache (queries repeat, documents don't)
const queryCache = new LRUCache(500);

class EmbeddingService {
  constructor() {
    this.model = EMBEDDING_MODEL;
    this.dimensions = EMBEDDING_DIMENSIONS;
  }

  /**
   * Build a text representation of a profile for embedding.
   * Combines core fields: title + summary + skills (flattened) + aiKeywords
   * 
   * @param {Object} profile - Sequelize Profile instance
   * @returns {string} - Concatenated text for embedding
   */
  buildProfileText(profile) {
    const parts = [];

    // Title
    if (profile.title) {
      parts.push(`Title: ${profile.title}`);
    }

    // Headline
    if (profile.headline) {
      parts.push(`Headline: ${profile.headline}`);
    }

    // Summary
    if (profile.summary) {
      parts.push(`Summary: ${profile.summary}`);
    }

    // Skills - flatten from various formats
    const skills = this.extractSkills(profile.skills);
    if (skills.length > 0) {
      parts.push(`Skills: ${skills.join(', ')}`);
    }

    // AI Keywords
    if (profile.aiKeywords && Array.isArray(profile.aiKeywords) && profile.aiKeywords.length > 0) {
      parts.push(`Keywords: ${profile.aiKeywords.join(', ')}`);
    }

    return parts.join('. ');
  }

  /**
   * Extract flat skill list from Profile.skills (handles various formats)
   * @param {*} profileSkills 
   * @returns {string[]}
   */
  extractSkills(profileSkills) {
    if (!profileSkills) return [];
    const skills = [];

    if (Array.isArray(profileSkills)) {
      profileSkills.forEach(skill => {
        if (typeof skill === 'string') skills.push(skill);
        else if (skill && skill.name) skills.push(skill.name);
      });
    } else if (typeof profileSkills === 'object') {
      Object.values(profileSkills).forEach(categorySkills => {
        if (Array.isArray(categorySkills)) {
          categorySkills.forEach(skill => {
            if (typeof skill === 'string') skills.push(skill);
            else if (skill && skill.name) skills.push(skill.name);
          });
        }
      });
    }

    return skills;
  }

  /**
   * Generate embedding for a single profile (document type).
   * Stores the embedding directly on the profile row in PostgreSQL.
   * 
   * @param {Object} profile - Sequelize Profile instance
   * @returns {Promise<number[]|null>} - The embedding vector, or null on failure
   */
  async generateProfileEmbedding(profile) {
    try {
      const text = this.buildProfileText(profile);
      if (!text || text.length < 10) {
        console.log(`[EmbeddingService] Profile ${profile.id} has insufficient text for embedding`);
        return null;
      }

      const response = await voyageClient.embed({
        input: [text],
        model: this.model,
        inputType: 'document'
      });

      const embedding = response.data?.[0]?.embedding;
      if (!embedding) {
        console.error(`[EmbeddingService] No embedding returned for profile ${profile.id}`);
        return null;
      }

      // Store in database
      await sequelize.query(
        `UPDATE "Profiles" SET embedding = $1, "embeddingUpdatedAt" = NOW() WHERE id = $2`,
        {
          bind: [JSON.stringify(embedding), profile.id],
          type: sequelize.constructor.QueryTypes.UPDATE
        }
      );

      console.log(`[EmbeddingService] Generated embedding for profile ${profile.id} (${embedding.length} dims)`);
      return embedding;
    } catch (error) {
      console.error(`[EmbeddingService] Error generating profile embedding:`, error.message);
      return null;
    }
  }

  /**
   * Generate embeddings for multiple profiles in batch.
   * More efficient than calling generateProfileEmbedding one by one.
   * 
   * @param {Object[]} profiles - Array of Sequelize Profile instances
   * @returns {Promise<{success: number, failed: number}>}
   */
  async generateBatchEmbeddings(profiles) {
    let success = 0;
    let failed = 0;

    // Process in chunks of MAX_BATCH_SIZE
    for (let i = 0; i < profiles.length; i += MAX_BATCH_SIZE) {
      const batch = profiles.slice(i, i + MAX_BATCH_SIZE);
      const texts = [];
      const validProfiles = [];

      for (const profile of batch) {
        const text = this.buildProfileText(profile);
        if (text && text.length >= 10) {
          texts.push(text);
          validProfiles.push(profile);
        } else {
          failed++;
        }
      }

      if (texts.length === 0) continue;

      try {
        const response = await voyageClient.embed({
          input: texts,
          model: this.model,
          inputType: 'document'
        });

        // Update each profile with its embedding — batch UPDATE for efficiency
        const updatePromises = [];
        for (let j = 0; j < validProfiles.length; j++) {
          const embedding = response.data?.[j]?.embedding;
          if (embedding) {
            updatePromises.push(
              sequelize.query(
                `UPDATE "Profiles" SET embedding = $1, "embeddingUpdatedAt" = NOW() WHERE id = $2`,
                {
                  bind: [JSON.stringify(embedding), validProfiles[j].id],
                  type: sequelize.constructor.QueryTypes.UPDATE
                }
              ).then(() => { success++; })
            );
          } else {
            failed++;
          }
        }
        // Execute all updates concurrently within each batch
        await Promise.all(updatePromises);
      } catch (error) {
        console.error(`[EmbeddingService] Batch embedding error:`, error.message);
        failed += texts.length;
      }

      // Rate limiting: small delay between batches
      if (i + MAX_BATCH_SIZE < profiles.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return { success, failed };
  }

  /**
   * Generate embedding for a search query (query type).
   * Uses asymmetric input_type='query' for optimal retrieval.
   * Results are cached since recruiters often repeat similar searches.
   * 
   * @param {string} queryText - The search query / job description
   * @returns {Promise<number[]|null>} - The query embedding vector
   */
  async generateQueryEmbedding(queryText) {
    if (!queryText || queryText.trim().length === 0) return null;

    const cacheKey = queryText.trim().toLowerCase();

    // Check cache
    if (queryCache.has(cacheKey)) {
      return queryCache.get(cacheKey);
    }

    try {
      const response = await voyageClient.embed({
        input: [queryText],
        model: this.model,
        inputType: 'query'
      });

      const embedding = response.data?.[0]?.embedding;
      if (!embedding) return null;

      // Cache it (LRU handles eviction automatically)
      queryCache.set(cacheKey, embedding);

      return embedding;
    } catch (error) {
      console.error(`[EmbeddingService] Error generating query embedding:`, error.message);
      return null;
    }
  }

  /**
   * Build a query text from job details for semantic search.
   * 
   * @param {Object} job - Job model instance
   * @returns {string} - Query text combining job title, skills, description
   */
  buildJobQueryText(job) {
    const parts = [];
    if (job.title) parts.push(job.title);
    if (job.skills && Array.isArray(job.skills) && job.skills.length > 0) {
      parts.push(`Skills: ${job.skills.join(', ')}`);
    }
    if (job.description) {
      // Truncate long descriptions to keep query focused
      const desc = job.description.substring(0, 500);
      parts.push(desc);
    }
    if (job.requirements) {
      const reqs = typeof job.requirements === 'string' 
        ? job.requirements.substring(0, 300)
        : '';
      if (reqs) parts.push(reqs);
    }
    return parts.join('. ');
  }

  /**
   * Perform semantic vector search using pgvector cosine distance.
   * This is the RETRIEVAL step of RAG.
   * 
   * @param {number[]} queryEmbedding - The query vector
   * @param {Object} options - Search options
   * @param {number} options.limit - Max results (default 50)
   * @param {string} options.location - Optional location filter
   * @param {string[]} options.availabilityStatuses - Availability filter
   * @param {string} options.excludeUserId - Exclude this user (usually the job poster)
   * @returns {Promise<Object[]>} - Ranked profiles with similarity scores
   */
  async searchSimilarProfiles(queryEmbedding, options = {}) {
    const {
      limit = 50,
      location = null,
      availabilityStatuses = ['actively-looking', 'open', 'not-looking'],
      excludeUserId = null
    } = options;

    try {
      // Build WHERE clause dynamically
      const conditions = [
        `p.embedding IS NOT NULL`,
        `p."isPublic" = true`,
        `u.role = 'candidate'`
      ];
      const binds = [JSON.stringify(queryEmbedding), limit];
      let bindIndex = 3;

      if (excludeUserId) {
        conditions.push(`p."userId" != $${bindIndex}`);
        binds.push(excludeUserId);
        bindIndex++;
      }

      if (availabilityStatuses && availabilityStatuses.length > 0) {
        const placeholders = availabilityStatuses.map((_, i) => `$${bindIndex + i}`);
        conditions.push(`p."availabilityStatus" IN (${placeholders.join(', ')})`);
        binds.push(...availabilityStatuses);
        bindIndex += availabilityStatuses.length;
      }

      if (location) {
        conditions.push(`p.location ILIKE $${bindIndex}`);
        binds.push(`%${location}%`);
        bindIndex++;
      }

      const whereClause = conditions.join(' AND ');

      const query = `
        SELECT 
          p.*,
          u."firstName", u."lastName", u.email, u.id as "userId",
          1 - (p.embedding <=> $1::vector) as similarity
        FROM "Profiles" p
        JOIN "Users" u ON p."userId" = u.id
        WHERE ${whereClause}
        ORDER BY p.embedding <=> $1::vector
        LIMIT $2
      `;

      const results = await sequelize.query(query, {
        bind: binds,
        type: sequelize.constructor.QueryTypes.SELECT
      });

      return results.map(row => ({
        ...row,
        similarity: parseFloat(row.similarity) || 0,
        // Remove the raw embedding from results to save memory
        embedding: undefined
      }));
    } catch (error) {
      console.error(`[EmbeddingService] Vector search error:`, error.message);
      return [];
    }
  }

  /**
   * Check if a profile's embedding needs updating.
   * Returns true if embedding is missing or older than the profile's last update.
   * 
   * @param {Object} profile - Sequelize Profile instance
   * @returns {boolean}
   */
  needsEmbeddingUpdate(profile) {
    if (!profile.embedding || !profile.embeddingUpdatedAt) return true;
    // Re-embed if profile was updated after the embedding
    return new Date(profile.updatedAt) > new Date(profile.embeddingUpdatedAt);
  }

  /**
   * Generate embedding for a single skill text (for skill-to-skill comparison).
   * Used by the refactored aiSkillsMatchingService.
   * 
   * @param {string} text - Skill text
   * @returns {Promise<number[]|null>}
   */
  async getSkillEmbedding(text) {
    const normalized = text.toLowerCase().trim();

    // Check query cache (skills are short, same cache works)
    if (queryCache.has(`skill:${normalized}`)) {
      return queryCache.get(`skill:${normalized}`);
    }

    try {
      const response = await voyageClient.embed({
        input: [normalized],
        model: this.model,
        inputType: 'document' // Skills are concepts, not queries
      });

      const embedding = response.data?.[0]?.embedding;
      if (!embedding) return null;

      // Cache it (LRU handles eviction)
      queryCache.set(`skill:${normalized}`, embedding);

      return embedding;
    } catch (error) {
      console.error(`[EmbeddingService] Skill embedding error:`, error.message);
      return null;
    }
  }

  /**
   * Batch embed skill texts (for skill matching).
   * 
   * @param {string[]} texts - Array of skill strings
   * @returns {Promise<Map<string, number[]>>}
   */
  async getBatchSkillEmbeddings(texts) {
    const results = new Map();
    const uncached = [];

    // Check cache
    for (const text of texts) {
      const normalized = text.toLowerCase().trim();
      const cacheKey = `skill:${normalized}`;
      if (queryCache.has(cacheKey)) {
        results.set(normalized, queryCache.get(cacheKey));
      } else {
        uncached.push(normalized);
      }
    }

    if (uncached.length === 0) return results;

    try {
      // Process in batches
      for (let i = 0; i < uncached.length; i += MAX_BATCH_SIZE) {
        const batch = uncached.slice(i, i + MAX_BATCH_SIZE);

        const response = await voyageClient.embed({
          input: batch,
          model: this.model
        });

        response.data?.forEach((item, idx) => {
          const text = batch[idx];
          const embedding = item.embedding;
          if (embedding) {
            results.set(text, embedding);
            // Cache (LRU handles eviction)
            queryCache.set(`skill:${text}`, embedding);
          }
        });
      }
    } catch (error) {
      console.error(`[EmbeddingService] Batch skill embedding error:`, error.message);
      // Re-throw so callers can fall back to string matching
      throw error;
    }

    return results;
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      queryCacheSize: queryCache.size,
      maxSize: queryCache._map ? queryCache._map.size : queryCache.size
    };
  }

  /**
   * Clear caches
   */
  clearCache() {
    queryCache.clear();
  }
}

// Export singleton
const embeddingService = new EmbeddingService();

module.exports = {
  embeddingService,
  EmbeddingService,
  EMBEDDING_DIMENSIONS
};
