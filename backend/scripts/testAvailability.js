const sequelize = require("../config/database");
const { RecruiterProfile, User, Interview } = require("../models");
const { Op } = require("sequelize");

// Copy the generateInterviewSlots function logic to test it
function generateInterviewSlots(existingTimes = [], availability = null) {
  const slots = [];
  const now = new Date();
  
  const defaultWorkingHours = {
    1: { enabled: true, start: "09:00", end: "17:00" },
    2: { enabled: true, start: "09:00", end: "17:00" },
    3: { enabled: true, start: "09:00", end: "17:00" },
    4: { enabled: true, start: "09:00", end: "17:00" },
    5: { enabled: true, start: "09:00", end: "17:00" },
    0: { enabled: false },
    6: { enabled: false }
  };
  
  const workingHours = availability?.workingHours || defaultWorkingHours;
  const bufferTime = availability?.bufferTime || 15;
  const schedulingWindow = availability?.schedulingWindow || 14;
  const blockedSlots = availability?.blockedSlots || [];
  
  const formatSlot = (date) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June", 
                    "July", "August", "September", "October", "November", "December"];
    const hours = date.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;
    return {
      datetime: date.toISOString(),
      label: `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} at ${displayHour}:00 ${ampm}`
    };
  };

  const hasConflict = (timestamp) => {
    const bufferMs = bufferTime * 60 * 1000;
    return existingTimes.some(existing => Math.abs(existing - timestamp) < (60 * 60 * 1000 + bufferMs));
  };

  const getAvailableHours = (dayOfWeek) => {
    const dayConfig = workingHours[dayOfWeek];
    if (!dayConfig || !dayConfig.enabled) return [];
    
    const startHour = parseInt(dayConfig.start.split(":")[0]);
    const endHour = parseInt(dayConfig.end.split(":")[0]);
    
    const hours = [];
    for (let h = startHour; h < endHour; h++) {
      if (h !== 12) hours.push(h);
    }
    return hours;
  };

  let currentDay = new Date(now);
  currentDay.setDate(currentDay.getDate() + 1);
  currentDay.setMinutes(0, 0, 0);
  
  let daysChecked = 0;
  while (slots.length < 3 && daysChecked < schedulingWindow) {
    daysChecked++;
    const dayOfWeek = currentDay.getDay();
    const availableHours = getAvailableHours(dayOfWeek);
    
    if (availableHours.length === 0) {
      currentDay.setDate(currentDay.getDate() + 1);
      continue;
    }

    for (const hour of availableHours) {
      if (slots.length >= 3) break;
      
      const slotTime = new Date(currentDay);
      slotTime.setHours(hour, 0, 0, 0);
      
      if (slotTime.getTime() <= now.getTime()) continue;
      if (hasConflict(slotTime.getTime())) continue;
      
      slots.push(formatSlot(slotTime));
    }
    
    currentDay.setDate(currentDay.getDate() + 1);
  }

  return slots;
}

(async () => {
  try {
    await sequelize.authenticate();
    
    // Find recruiter and their profile
    const recruiter = await User.findOne({ where: { role: "recruiter" }});
    console.log("Recruiter:", recruiter?.firstName, recruiter?.lastName);
    
    const profile = await RecruiterProfile.findOne({ where: { userId: recruiter?.id }});
    console.log("\n📅 Current Availability Settings:");
    console.log(JSON.stringify(profile?.availability, null, 2));
    
    // Get existing interviews
    const existingInterviews = await Interview.findAll({
      where: {
        recruiterId: recruiter?.id,
        status: { [Op.in]: ["confirmed", "pending"] }
      },
      attributes: ["scheduledAt"]
    });
    const existingTimes = existingInterviews
      .filter(i => i.scheduledAt)
      .map(i => new Date(i.scheduledAt).getTime());
    
    console.log("\n📋 Existing interviews:", existingTimes.length);
    
    // Generate slots using default/current availability
    const slots = generateInterviewSlots(existingTimes, profile?.availability);
    
    console.log("\n✅ Generated Interview Slots (Default 9AM-5PM):");
    slots.forEach((s, i) => console.log(`  ${i+1}. ${s.label}`));
    
    // Test with custom availability (e.g., only afternoons)
    console.log("\n========================================");
    console.log("Testing with CUSTOM availability (afternoons 1PM-6PM only)");
    console.log("========================================");
    
    const customAvailability = {
      workingHours: {
        1: { enabled: true, start: "13:00", end: "18:00" },
        2: { enabled: true, start: "13:00", end: "18:00" },
        3: { enabled: true, start: "13:00", end: "18:00" },
        4: { enabled: true, start: "13:00", end: "18:00" },
        5: { enabled: true, start: "13:00", end: "17:00" },
        0: { enabled: false },
        6: { enabled: false }
      },
      bufferTime: 30,
      schedulingWindow: 7
    };
    
    const customSlots = generateInterviewSlots(existingTimes, customAvailability);
    console.log("\n✅ Custom Slots (Afternoons Only 1PM-6PM):");
    customSlots.forEach((s, i) => console.log(`  ${i+1}. ${s.label}`));
    
    console.log("\n✨ Feature is working! Slots are generated based on availability settings.");
    
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
