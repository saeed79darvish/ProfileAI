const { Poll, PollVote } = require('../models');

(async () => {
  try {
    const polls = await Poll.findAll();
    
    for (const poll of polls) {
      // Count actual votes from PollVote table
      const votes = await PollVote.findAll({ where: { pollId: poll.id } });
      
      // Build vote counts per option
      const voteCounts = {};
      for (const v of votes) {
        voteCounts[v.optionId] = (voteCounts[v.optionId] || 0) + 1;
      }
      
      // Update options with correct vote counts
      const updatedOptions = poll.options.map(opt => ({
        ...opt,
        votes: voteCounts[opt.id] || 0
      }));
      
      // Save with force change detection
      poll.options = updatedOptions;
      poll.totalVotes = votes.length;
      poll.changed('options', true);
      await poll.save();
      
      console.log('Fixed poll:', poll.question);
      console.log('Options:', JSON.stringify(updatedOptions));
      console.log('Total votes:', votes.length);
    }
    
    console.log('\nAll polls fixed!');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
