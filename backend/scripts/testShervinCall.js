/**
 * Test Script: Make a phone screening call for Shervin Najafi - Android Position
 * 
 * Usage: cd backend && node scripts/testShervinCall.js
 */

require('dotenv').config();
const { User, Profile, Job, Interview, PhoneScreeningCall } = require('../models');
const vapiService = require('../services/vapiService');

const PHONE_NUMBER = '4155835618';

async function runTestCall() {
  console.log('\n📞 Test Phone Screening Call for Shervin Najafi\n');
  console.log('================================================\n');
  
  try {
    // Find or create Shervin Najafi
    let user = await User.findOne({
      where: { email: 'shervin@example.com' },
      include: [{ model: Profile, as: 'profile' }]
    });
    
    if (!user) {
      console.log('Creating Shervin Najafi profile...');
      user = await User.create({
        email: 'shervin@example.com',
        password: 'test123',
        firstName: 'Shervin',
        lastName: 'Najafi',
        role: 'candidate'
      });
      
      await Profile.create({
        userId: user.id,
        title: 'Senior Android Developer',
        headline: 'Senior Android Developer',
        skills: ['Android', 'Kotlin', 'Java', 'MVVM', 'Room', 'Jetpack Compose', 'Retrofit', 'Coroutines'],
        experience: [
          {
            title: 'Senior Android Developer',
            company: 'Tech Company',
            duration: '5 years',
            description: 'Built high-performance Android applications with modern architecture'
          }
        ]
      });
      
      user = await User.findByPk(user.id, {
        include: [{ model: Profile, as: 'profile' }]
      });
      console.log('✓ Created Shervin Najafi profile');
    } else {
      console.log('✓ Found Shervin Najafi user');
      
      // Check if profile exists, create if not
      if (!user.profile) {
        console.log('Creating missing profile...');
        await Profile.create({
          userId: user.id,
          title: 'Senior Android Developer',
          headline: 'Senior Android Developer',
          skills: ['Android', 'Kotlin', 'Java', 'MVVM', 'Room', 'Jetpack Compose', 'Retrofit', 'Coroutines'],
          experience: [
            {
              title: 'Senior Android Developer',
              company: 'Tech Company',
              duration: '5 years',
              description: 'Built high-performance Android applications with modern architecture'
            }
          ]
        });
        
        user = await User.findByPk(user.id, {
          include: [{ model: Profile, as: 'profile' }]
        });
        console.log('✓ Created profile');
      } else {
        console.log('✓ Profile exists');
      }
    }
    
    // Find or create Android Developer job
    let job = await Job.findOne({
      where: { title: 'Android Developer' }
    });
    
    if (!job) {
      console.log('Creating Android Developer job...');
      const recruiter = await User.findOne({ where: { role: 'recruiter' } });
      const userId = recruiter?.id || user.id;
      
      job = await Job.create({
        userId: userId,
        title: 'Android Developer',
        company: 'ProfileAI',
        description: 'We are looking for an experienced Android developer to build cutting-edge mobile applications using modern Android technologies.',
        requirements: '5+ years Android development, Kotlin, Jetpack Compose, MVVM architecture, REST APIs, Material Design',
        location: 'San Francisco, CA',
        locationType: 'hybrid',
        employmentType: 'full-time',
        experienceLevel: 'senior',
        salaryMin: 120000,
        salaryMax: 180000,
        salaryCurrency: 'USD',
        status: 'active'
      });
      console.log('✓ Created Android Developer job');
    } else {
      console.log('✓ Found Android Developer job');
    }
    
    // Find or create interview
    let interview = await Interview.findOne({
      where: {
        candidateId: user.id,
        jobId: job.id
      }
    });
    
    if (!interview) {
      console.log('Creating interview record...');
      const recruiter = await User.findOne({ where: { role: 'recruiter' } });
      
      interview = await Interview.create({
        jobId: job.id,
        candidateId: user.id,
        recruiterId: recruiter?.id || user.id,
        status: 'confirmed',
        type: 'screening',
        format: 'phone',
        scheduledAt: new Date(),
        duration: 10
      });
      console.log('✓ Created interview record');
    } else {
      console.log('✓ Found interview record');
    }
    
    // Create phone screening call record
    console.log('Creating phone screening call record...');
    const phoneScreening = await PhoneScreeningCall.create({
      jobId: job.id,
      interviewId: interview.id,
      candidateId: user.id,
      recruiterId: interview.recruiterId,
      candidatePhone: PHONE_NUMBER,
      scheduledAt: new Date(),
      duration: 10, // 10 minute test call
      status: 'scheduled'
    });
    console.log('✓ Created phone screening call record');
    
    console.log('\n📋 Call Details:');
    
    // Reload user with profile if needed
    const userWithProfile = await User.findByPk(user.id, {
      include: [{ model: Profile, as: 'profile' }]
    });
    
    if (!userWithProfile || !userWithProfile.profile) {
      throw new Error('Could not load user profile. Please check database.');
    }
    
    console.log(`   Candidate: ${userWithProfile.firstName} ${userWithProfile.lastName}`);
    console.log(`   Phone: ${PHONE_NUMBER}`);
    console.log(`   Job: ${job.title} at ${job.company}`);
    console.log(`   Interview ID: ${interview.id}`);
    console.log(`   Phone Screening ID: ${phoneScreening.id}`);
    
    // Initiate the call via Vapi
    console.log('\n🚀 Initiating call via Vapi...\n');
    const result = await vapiService.initiateCall(phoneScreening.id);
    
    console.log('✅ Call initiated successfully!');
    console.log(`   Vapi Call ID: ${result.vapiCallId}`);
    console.log('\n📱 The phone should ring shortly at:', PHONE_NUMBER);
    console.log('\n💡 To check call status, query PhoneScreeningCall table with ID:', phoneScreening.id);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('API Error:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

runTestCall();
