require('dotenv').config();
const axios = require('axios');
const { PhoneScreeningCall } = require('../models');

const VAPI_API_KEY = process.env.VAPI_API_KEY;
const callId = process.argv[2] || '019bdfae-9d43-7000-8042-6330ea41ecd8';

(async () => {
  try {
    console.log(`Fetching call ${callId} from Vapi...`);
    
    const response = await axios.get(`https://api.vapi.ai/call/${callId}`, {
      headers: { 'Authorization': `Bearer ${VAPI_API_KEY}` }
    });
    
    const callData = response.data;
    console.log('\n✅ Vapi Call Data:');
    console.log('  Status:', callData.status);
    console.log('  Started:', callData.startedAt);
    console.log('  Ended:', callData.endedAt);
    console.log('  Ended Reason:', callData.endedReason);
    console.log('  Cost:', callData.cost);
    console.log('  Transcript available:', callData.transcript ? 'YES' : 'NO');
    console.log('  Analysis available:', callData.analysis ? 'YES' : 'NO');
    
    // Find the phone screening call in our database
    const phoneScreening = await PhoneScreeningCall.findOne({
      where: { vapiCallId: callId }
    });
    
    if (!phoneScreening) {
      console.log('\n❌ Phone screening call not found in database');
      process.exit(1);
    }
    
    console.log('\n📋 Current DB Status:', phoneScreening.status);
    
    if (callData.status === 'ended') {
      console.log('\n🔄 Updating database with Vapi results...');
      
      // Extract transcript
      const transcript = callData.transcript || callData.messages?.map(m => 
        `${m.role === 'assistant' ? 'AI' : 'Candidate'}: ${m.message}`
      ).join('\n\n');
      
      // Update the phone screening call
      await phoneScreening.update({
        status: 'completed',
        startedAt: callData.startedAt,
        endedAt: callData.endedAt,
        durationSeconds: callData.duration,
        transcript: transcript,
        transcriptMessages: callData.messages || [],
        recordingUrl: callData.recordingUrl,
        endedReason: callData.endedReason,
        cost: callData.cost,
        vapiRawResponse: callData,
        summary: callData.analysis?.summary || 'Call completed successfully',
        screeningScore: callData.analysis?.score || null,
        screeningResult: callData.analysis?.result || 'needs_review', // Valid: passed, failed, needs_review, inconclusive
        recommendation: callData.analysis?.recommendation || null,
        strengths: callData.analysis?.strengths || [],
        concerns: callData.analysis?.concerns || []
      });
      
      console.log('✅ Database updated successfully!');
      console.log('\n📊 Results:');
      console.log('  Status:', 'completed');
      console.log('  Duration:', callData.duration || 'N/A', 'seconds');
      console.log('  Transcript length:', transcript?.length || 0, 'chars');
      console.log('  Score:', callData.analysis?.score || 'N/A');
    } else {
      console.log('\n⏳ Call is still in progress:', callData.status);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
})();
