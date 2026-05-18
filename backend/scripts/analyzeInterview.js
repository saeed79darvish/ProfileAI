require('dotenv').config();
const OpenAI = require('openai');
const { PhoneScreeningCall, Job } = require('../models');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const callId = process.argv[2] || '019bdfae-9d43-7000-8042-6330ea41ecd8';

(async () => {
  try {
    console.log('🔍 Analyzing interview transcript...\n');
    
    const phoneScreening = await PhoneScreeningCall.findOne({
      where: { vapiCallId: callId },
      include: [{ model: Job, as: 'Job' }]
    });
    
    if (!phoneScreening) {
      console.log('❌ Phone screening not found');
      process.exit(1);
    }
    
    if (!phoneScreening.transcript) {
      console.log('❌ No transcript available');
      process.exit(1);
    }
    
    const job = phoneScreening.Job;
    const transcript = phoneScreening.transcript;
    
    console.log('📝 Transcript length:', transcript.length, 'characters');
    console.log('💼 Job:', job.title, 'at', job.company);
    console.log('\n🤖 Generating AI analysis...\n');
    
    // Use OpenAI to analyze the transcript
    const analysisPrompt = `You are an expert recruiter analyzing a phone screening interview transcript for a ${job.title} position at ${job.company}.

TRANSCRIPT:
${transcript}

JOB REQUIREMENTS:
${job.requirements || 'Not specified'}

Please provide a comprehensive analysis in JSON format with the following structure:
{
  "summary": "2-3 sentence executive summary of the interview",
  "screeningScore": 75, // 0-100 score
  "screeningResult": "passed", // passed, failed, needs_review, or inconclusive
  "recommendation": "hire", // strong_hire, hire, maybe, no_hire, or strong_no_hire
  "strengths": ["strength 1", "strength 2", "strength 3"], // 3-5 key strengths
  "concerns": ["concern 1", "concern 2"], // 2-4 concerns or red flags
  "keyQuotes": ["quote 1", "quote 2"], // 2-3 notable quotes from candidate
  "technicalSkills": ["skill 1", "skill 2"], // mentioned technical skills
  "experience": "Brief summary of relevant experience",
  "communication": "Assessment of communication skills",
  "culturalFit": "Assessment of cultural fit and enthusiasm",
  "nextSteps": "Recommended next steps"
}

Provide ONLY the JSON object, no additional text.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: analysisPrompt }],
      temperature: 0.3,
      max_tokens: 2000
    });
    
    const analysis = JSON.parse(response.choices[0].message.content.trim());
    
    console.log('✅ Analysis complete!\n');
    console.log('📊 Score:', analysis.screeningScore, '/100');
    console.log('🎯 Result:', analysis.screeningResult);
    console.log('👍 Recommendation:', analysis.recommendation);
    console.log('\n💪 Strengths:');
    analysis.strengths.forEach(s => console.log('  •', s));
    console.log('\n⚠️  Concerns:');
    analysis.concerns.forEach(c => console.log('  •', c));
    
    // Update the database
    console.log('\n💾 Updating database...');
    await phoneScreening.update({
      summary: analysis.summary,
      screeningScore: analysis.screeningScore,
      screeningResult: analysis.screeningResult,
      recommendation: analysis.recommendation,
      strengths: analysis.strengths,
      concerns: analysis.concerns,
      keyQuotes: analysis.keyQuotes,
      extractedData: {
        technicalSkills: analysis.technicalSkills,
        experience: analysis.experience,
        communication: analysis.communication,
        culturalFit: analysis.culturalFit,
        nextSteps: analysis.nextSteps
      }
    });
    
    console.log('✅ Interview analysis saved to database!');
    console.log('\n📄 Summary:');
    console.log(analysis.summary);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
    process.exit(1);
  }
})();
