import api from './api';

const base = (id) => `/interview-prep/${encodeURIComponent(id)}`;

// Interview prep endpoints. Auth comes from the shared axios instance.
export const interviewPrepAPI = {
  start: (company, jobTitle, refresh = false) => api.post('/interview-prep', { company, jobTitle, refresh }),
  get: (id) => api.get(base(id)),
  personalize: (id, tailoredProfileId) => api.post(`${base(id)}/personalize`, { tailoredProfileId }),
  storyTopics: (id, tailoredProfileId) => api.post(`${base(id)}/stories/topics`, { tailoredProfileId }),
  writeStory: (id, body) => api.post(`${base(id)}/stories`, body),
  listStories: (id) => api.get(`${base(id)}/stories`),
  updateStory: (id, storyId, spoken) => api.patch(`${base(id)}/stories/${encodeURIComponent(storyId)}`, { spoken }),
  deleteStory: (id, storyId) => api.delete(`${base(id)}/stories/${encodeURIComponent(storyId)}`),
};

export default interviewPrepAPI;
