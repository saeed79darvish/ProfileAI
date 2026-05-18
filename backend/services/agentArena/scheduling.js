/**
 * Agent Arena Scheduling Utilities
 * 
 * Interview slot generation and scheduling helpers for the Agent Arena service.
 */

/**
 * Default working hours configuration
 */
const DEFAULT_WORKING_HOURS = {
  1: { enabled: true, start: '09:00', end: '17:00' },  // Monday
  2: { enabled: true, start: '09:00', end: '17:00' },  // Tuesday
  3: { enabled: true, start: '09:00', end: '17:00' },  // Wednesday
  4: { enabled: true, start: '09:00', end: '17:00' },  // Thursday
  5: { enabled: true, start: '09:00', end: '17:00' },  // Friday
  0: { enabled: false },  // Sunday
  6: { enabled: false }   // Saturday
};

/**
 * Format a date into a human-readable slot label
 * @param {Date} date - The date to format
 * @returns {Object} Formatted slot with datetime and label
 */
function formatSlot(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  const displayMinutes = minutes === 0 ? '' : `:${minutes.toString().padStart(2, '0')}`;
  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const dayOfMonth = date.getDate();
  const year = date.getFullYear();
  return {
    datetime: date.toISOString(),
    label: `${dayName}, ${monthName} ${dayOfMonth}, ${year} at ${displayHour}${displayMinutes} ${ampm}`
  };
}

/**
 * Check if a time slot conflicts with existing interviews
 * @param {number} timestamp - Timestamp to check
 * @param {number[]} existingTimes - Array of existing interview timestamps
 * @param {number} bufferMinutes - Buffer time in minutes
 * @returns {boolean}
 */
function hasConflict(timestamp, existingTimes, bufferMinutes = 15) {
  const bufferMs = bufferMinutes * 60 * 1000;
  return existingTimes.some(existing => Math.abs(existing - timestamp) < (60 * 60 * 1000 + bufferMs));
}

/**
 * Check if a slot is in a blocked time period
 * @param {Date} slotDate - Slot date to check
 * @param {Array} blockedSlots - Array of blocked slot configurations
 * @returns {boolean}
 */
function isBlocked(slotDate, blockedSlots = []) {
  return blockedSlots.some(blocked => {
    if (blocked.type === 'recurring') {
      // Check if day of week and time match
      const dayMatch = blocked.dayOfWeek === slotDate.getDay();
      const startTime = blocked.start.split(':');
      const endTime = blocked.end.split(':');
      const slotHour = slotDate.getHours();
      const startHour = parseInt(startTime[0]);
      const endHour = parseInt(endTime[0]);
      return dayMatch && slotHour >= startHour && slotHour < endHour;
    } else {
      // One-time block - check exact date range
      const blockStart = new Date(blocked.start);
      const blockEnd = new Date(blocked.end);
      return slotDate >= blockStart && slotDate <= blockEnd;
    }
  });
}

/**
 * Get available hours for a day based on working hours config
 * @param {number} dayOfWeek - Day of week (0-6)
 * @param {Object} workingHours - Working hours configuration
 * @returns {number[]} Array of available hour numbers
 */
function getAvailableHours(dayOfWeek, workingHours) {
  const dayConfig = workingHours[dayOfWeek];
  if (!dayConfig || !dayConfig.enabled) return [];
  
  const startParts = dayConfig.start.split(':');
  const endParts = dayConfig.end.split(':');
  const startHour = parseInt(startParts[0]);
  const endHour = parseInt(endParts[0]);
  
  // Generate hour slots, skipping typical lunch hour (12-13)
  const hours = [];
  for (let h = startHour; h < endHour; h++) {
    if (h !== 12) { // Skip lunch hour
      hours.push(h);
    }
  }
  return hours;
}

/**
 * Generate reasonable interview time slots based on recruiter's availability
 * @param {number[]} existingTimes - Array of existing interview times as timestamps
 * @param {Object} availability - Recruiter's availability settings from RecruiterProfile
 * @returns {Array} Array of formatted slot objects
 */
function generateInterviewSlots(existingTimes = [], availability = null) {
  const slots = [];
  const now = new Date();
  
  const workingHours = availability?.workingHours || DEFAULT_WORKING_HOURS;
  const bufferTime = availability?.bufferTime || 15; // minutes
  const schedulingWindow = availability?.schedulingWindow || 14; // days
  const blockedSlots = availability?.blockedSlots || [];

  // Generate slots for the scheduling window
  let currentDay = new Date(now);
  currentDay.setDate(currentDay.getDate() + 1); // Start from tomorrow
  currentDay.setMinutes(0, 0, 0);
  
  let daysChecked = 0;
  while (slots.length < 3 && daysChecked < schedulingWindow) {
    daysChecked++;
    const dayOfWeek = currentDay.getDay();
    const availableHours = getAvailableHours(dayOfWeek, workingHours);
    
    // Skip days with no availability
    if (availableHours.length === 0) {
      currentDay.setDate(currentDay.getDate() + 1);
      continue;
    }

    // Try each available hour
    for (const hour of availableHours) {
      if (slots.length >= 3) break;
      
      const slotTime = new Date(currentDay);
      slotTime.setHours(hour, 0, 0, 0);
      
      // Skip if in the past
      if (slotTime.getTime() <= now.getTime()) continue;
      
      // Skip if conflicts with existing interviews
      if (hasConflict(slotTime.getTime(), existingTimes, bufferTime)) continue;
      
      // Skip if in blocked time
      if (isBlocked(slotTime, blockedSlots)) continue;
      
      // Check if we already have a slot at this time
      const alreadyHasSlot = slots.some(s => 
        new Date(s.datetime).getTime() === slotTime.getTime()
      );
      if (alreadyHasSlot) continue;
      
      slots.push(formatSlot(slotTime));
    }
    
    currentDay.setDate(currentDay.getDate() + 1);
  }

  // If we couldn't find 3 non-conflicting slots, generate fallback slots
  if (slots.length === 0) {
    const fallback = new Date(now);
    fallback.setDate(fallback.getDate() + 7);
    fallback.setHours(10, 0, 0, 0);
    // Find next working day
    let fallbackAttempts = 0;
    while (fallbackAttempts < 14) {
      const dayConfig = workingHours[fallback.getDay()];
      if (dayConfig && dayConfig.enabled) break;
      fallback.setDate(fallback.getDate() + 1);
      fallbackAttempts++;
    }
    slots.push(formatSlot(fallback));
  }

  return slots;
}

/**
 * Generate reschedule slots avoiding conflicting times
 * @param {Date} originalTime - Original interview time
 * @param {number[]} existingTimes - Existing interview timestamps
 * @param {Object} availability - Availability configuration
 * @returns {Array} Array of alternative slot options
 */
function generateRescheduleSlots(originalTime, existingTimes = [], availability = null) {
  // Filter out the original time from conflicts
  const filteredTimes = existingTimes.filter(t => 
    Math.abs(t - originalTime.getTime()) > 1000
  );
  
  return generateInterviewSlots(filteredTimes, availability);
}

module.exports = {
  DEFAULT_WORKING_HOURS,
  formatSlot,
  hasConflict,
  isBlocked,
  getAvailableHours,
  generateInterviewSlots,
  generateRescheduleSlots
};
