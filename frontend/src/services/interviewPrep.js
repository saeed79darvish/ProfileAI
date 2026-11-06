import api from './api';

// Interview prep endpoints. Auth comes from the shared axios instance.
export const interviewPrepAPI = {
  start: (company, jobTitle, refresh = false) => api.post('/interview-prep', { company, jobTitle, refresh }),
  get: (id) => api.get(`/interview-prep/${encodeURIComponent(id)}`),
  personalize: (id, tailoredProfileId) => api.post(`/interview-prep/${encodeURIComponent(id)}/personalize`, { tailoredProfileId }),
};

export default interviewPrepAPI;
