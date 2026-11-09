import api from './api';

const base = (id) => `/interview-prep/${encodeURIComponent(id)}`;

// Interview prep endpoints. Auth comes from the shared axios instance.
export const interviewPrepAPI = {
  // extra may carry level, tailoredProfileId and source ('link' | 'text' | 'role' | 'tailored').
  start: (company, jobTitle, refresh = false, extra = {}) => {
    const body = { company, jobTitle, refresh };
    for (const k of ['level', 'tailoredProfileId', 'source']) if (extra && extra[k]) body[k] = extra[k];
    return api.post('/interview-prep', body);
  },
  parseJob: ({ url, text }) => api.post('/interview-prep/parse-job', url ? { url } : { text }),
  mine: () => api.get('/interview-prep/mine'),
  get: (id) => api.get(base(id)),
  personalize: (id, tailoredProfileId) => api.post(`${base(id)}/personalize`, { tailoredProfileId }),
  storyTopics: (id, tailoredProfileId) => api.post(`${base(id)}/stories/topics`, { tailoredProfileId }),
  storyQuestions: (id, body) => api.post(`${base(id)}/stories/questions`, body),
  writeStory: (id, body) => api.post(`${base(id)}/stories`, body),
  listStories: (id) => api.get(`${base(id)}/stories`),
  updateStory: (id, storyId, spoken) => api.patch(`${base(id)}/stories/${encodeURIComponent(storyId)}`, { spoken }),
  startPractice: (id, body = {}) => api.post(`${base(id)}/practice/session`, body),
  savePractice: (id, body) => api.post(`${base(id)}/practice/sessions`, body),
  listPractice: (id) => api.get(`${base(id)}/practice/sessions`),
  getFocus: (id) => api.get(`${base(id)}/focus`),
  saveFocus: (id, focus) => api.put(`${base(id)}/focus`, focus),
  reviewCode: (id, body) => api.post(`${base(id)}/code/review`, body),
  listCodeAttempts: (id) => api.get(`${base(id)}/code/attempts`),
  deleteStory: (id, storyId) => api.delete(`${base(id)}/stories/${encodeURIComponent(storyId)}`),
};

export default interviewPrepAPI;
