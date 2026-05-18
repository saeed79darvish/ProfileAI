const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const vapiService = require('../services/vapiService');

// Vapi webhook secret for signature verification (optional but recommended)
const VAPI_WEBHOOK_SECRET = process.env.VAPI_WEBHOOK_SECRET;

/**
 * Verify Vapi webhook signature
 */
function verifyVapiSignature(req, res, next) {
  // If no secret configured, skip verification (not recommended for production)
  if (!VAPI_WEBHOOK_SECRET) {
    console.warn('⚠️ VAPI_WEBHOOK_SECRET not configured - skipping signature verification');
    return next();
  }
  
  const signature = req.headers['x-vapi-signature'];
  if (!signature) {
    console.warn('Missing Vapi signature header');
    return res.status(401).json({ error: 'Missing signature' });
  }
  
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', VAPI_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (signature !== expectedSignature) {
    console.warn('Invalid Vapi signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
}

/**
 * @route   POST /api/vapi/webhook
 * @desc    Main webhook endpoint for all Vapi events
 * @access  Public (but verified)
 */
router.post('/webhook', verifyVapiSignature, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Missing message in webhook payload' });
    }
    
    const { type, call, transcript, recordingUrl, summary } = message;
    
    console.log(`📞 Received Vapi webhook: ${type}`, call?.id ? `(Call: ${call.id})` : '');
    
    switch (type) {
      case 'status-update':
        await handleStatusUpdate(message);
        break;
        
      case 'end-of-call-report':
        await handleEndOfCallReport(message);
        break;
        
      case 'transcript':
        // Real-time transcript updates (optional handling)
        console.log('Transcript update received');
        break;
        
      case 'hang':
        // Call was hung up
        await vapiService.handleStatusUpdate({ call, status: 'ended' });
        break;
        
      case 'speech-update':
        // Real-time speech events (optional)
        break;
        
      case 'function-call':
        // Handle custom function calls from assistant
        await handleFunctionCall(message, res);
        return; // Function calls may need to return data
        
      case 'assistant-request':
        // Dynamic assistant configuration request
        await handleAssistantRequest(message, res);
        return;
        
      default:
        console.log(`Unhandled webhook type: ${type}`);
    }
    
    // Acknowledge receipt
    res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Error processing Vapi webhook:', error);
    // Still return 200 to prevent retries for application errors
    res.status(200).json({ success: false, error: error.message });
  }
});

/**
 * Handle status update events
 */
async function handleStatusUpdate(message) {
  const { call, status } = message;
  
  try {
    await vapiService.handleStatusUpdate({ call, status });
  } catch (error) {
    console.error('Error handling status update:', error);
  }
}

/**
 * Handle end of call report
 */
async function handleEndOfCallReport(message) {
  const { call, transcript, recordingUrl, summary, messages } = message;
  
  try {
    await vapiService.handleEndOfCallReport({
      call,
      transcript,
      recordingUrl,
      summary,
      messages
    });
  } catch (error) {
    console.error('Error handling end of call report:', error);
  }
}

/**
 * Handle function calls from the assistant
 * This allows the assistant to perform actions during the call
 */
async function handleFunctionCall(message, res) {
  const { functionCall, call } = message;
  
  if (!functionCall) {
    return res.status(200).json({ result: null });
  }
  
  const { name, parameters } = functionCall;
  
  console.log(`Function call: ${name}`, parameters);
  
  try {
    let result = null;
    
    switch (name) {
      case 'end_call':
        // Assistant wants to end the call
        result = { message: 'Call ending...' };
        break;
        
      case 'transfer_to_human':
        // Transfer to a human recruiter
        const { phoneNumber } = parameters;
        if (phoneNumber && call?.id) {
          await vapiService.transferToHuman(call.id, phoneNumber);
          result = { message: 'Transferring to human recruiter...' };
        }
        break;
        
      case 'schedule_followup':
        // Schedule a follow-up action
        result = { message: 'Follow-up scheduled' };
        break;
        
      case 'get_job_details':
        // Return additional job details
        // This would fetch from the database based on call metadata
        result = { details: 'Additional job details would be returned here' };
        break;
        
      default:
        console.log(`Unknown function call: ${name}`);
    }
    
    res.status(200).json({ result });
    
  } catch (error) {
    console.error('Error handling function call:', error);
    res.status(200).json({ result: null, error: error.message });
  }
}

/**
 * Handle assistant request for dynamic configuration
 */
async function handleAssistantRequest(message, res) {
  // This is called when Vapi needs assistant configuration
  // Useful for dynamic assistant setup
  const { call } = message;
  
  // Return null to use the pre-configured assistant
  res.status(200).json({ assistant: null });
}

/**
 * @route   POST /api/vapi/status-update
 * @desc    Dedicated endpoint for status updates (alternative to main webhook)
 * @access  Public (but verified)
 */
router.post('/status-update', verifyVapiSignature, async (req, res) => {
  try {
    const { call, status } = req.body;
    
    await vapiService.handleStatusUpdate({ call, status });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing status update:', error);
    res.status(200).json({ success: false, error: error.message });
  }
});

/**
 * @route   POST /api/vapi/end-of-call-report
 * @desc    Dedicated endpoint for end of call reports
 * @access  Public (but verified)
 */
router.post('/end-of-call-report', verifyVapiSignature, async (req, res) => {
  try {
    const { call, transcript, recordingUrl, summary, messages } = req.body;
    
    await vapiService.handleEndOfCallReport({
      call,
      transcript,
      recordingUrl,
      summary,
      messages
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing end of call report:', error);
    res.status(200).json({ success: false, error: error.message });
  }
});

module.exports = router;
