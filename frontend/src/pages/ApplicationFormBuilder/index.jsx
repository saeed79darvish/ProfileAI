import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowBack as BackIcon,
  Save as SaveIcon,
  Preview as PreviewIcon,
  DragIndicator as DragIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { jobAPI } from '../../services/api';
import { ROUTES, TEXT, formatQuestionCount, formatTemplateQuestionCount } from './constants';
import {
  PageContainer,
  Header,
  HeaderContent,
  HeaderLeft,
  BackButton,
  Title,
  HeaderActions,
  Button,
  Content,
  Panel,
  PanelHeader,
  PanelBody,
  TemplateCard,
  EmptyState,
  LoadingState,
  QuestionsList,
  QuestionCard
} from './styled';

const ApplicationFormBuilder = () => {
  const { id: jobId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [job, setJob] = useState(null);
  const [templates, setTemplates] = useState({});
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [questions, setQuestions] = useState([]);

  useEffect(() => {
    fetchJobAndTemplates();
  }, [jobId]);

  const fetchJobAndTemplates = async () => {
    try {
      setLoading(true);
      
      // Fetch job details
      const jobResponse = await jobAPI.getById(jobId);
      setJob(jobResponse.data);
      
      // If job already has questions, load them
      if (jobResponse.data.applicationQuestions && jobResponse.data.applicationQuestions.length > 0) {
        setQuestions(jobResponse.data.applicationQuestions);
      }
      
      // Fetch application templates
      const templatesResponse = await jobAPI.getApplicationTemplates();
      setTemplates(templatesResponse.data.templates || {});
      
    } catch (error) {
      console.error(TEXT.ERROR_FETCH, error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (templateKey) => {
    setSelectedTemplate(templateKey);
    const template = templates[templateKey];
    if (template && template.questions) {
      setQuestions([...template.questions]);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await jobAPI.update(jobId, {
        applicationQuestions: questions
      });
      navigate(ROUTES.RECRUITER_JOBS);
    } catch (error) {
      console.error(TEXT.ERROR_SAVE, error);
      alert(TEXT.SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <PageContainer>
        <Header>
          <HeaderContent>
            <Title>
              <h1>{TEXT.LOADING_TITLE}</h1>
            </Title>
          </HeaderContent>
        </Header>
        <Content style={{ display: 'block' }}>
          <LoadingState>
            <div className="spinner" />
            <p>{TEXT.LOADING_MESSAGE}</p>
          </LoadingState>
        </Content>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Header>
        <HeaderContent>
          <HeaderLeft>
            <BackButton onClick={() => navigate(ROUTES.RECRUITER_JOBS)}>
              <BackIcon fontSize="small" />
              {TEXT.BACK_LABEL}
            </BackButton>
            <Title>
              <h1>{TEXT.PAGE_TITLE}</h1>
              <p>{job?.title} - {job?.company}</p>
            </Title>
          </HeaderLeft>
          <HeaderActions>
            <Button onClick={() => navigate(ROUTES.RECRUITER_JOBS)}>
              {TEXT.CANCEL}
            </Button>
            <Button $primary onClick={handleSave} disabled={saving || questions.length === 0}>
              <SaveIcon fontSize="small" />
              {saving ? TEXT.SAVING : TEXT.SAVE}
            </Button>
          </HeaderActions>
        </HeaderContent>
      </Header>

      <Content>
        <Panel>
          <PanelHeader>
            <h2>{TEXT.TEMPLATE_PANEL_TITLE}</h2>
            <p>{TEXT.TEMPLATE_PANEL_DESC}</p>
          </PanelHeader>
          <PanelBody>
            {Object.entries(templates).map(([key, template]) => (
              <TemplateCard
                key={key}
                $selected={selectedTemplate === key}
                onClick={() => handleSelectTemplate(key)}
              >
                <h3>{template.name}</h3>
                <p>{template.description}</p>
                <div className="count">{formatTemplateQuestionCount(template.questions?.length || 0)}</div>
              </TemplateCard>
            ))}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <h2>{TEXT.QUESTIONS_PANEL_TITLE}</h2>
            <p>{formatQuestionCount(questions.length)}</p>
          </PanelHeader>
          <PanelBody>
            {questions.length === 0 ? (
              <EmptyState>
                <PreviewIcon />
                <h3>{TEXT.EMPTY_TITLE}</h3>
                <p>{TEXT.EMPTY_DESC}</p>
              </EmptyState>
            ) : (
              <QuestionsList>
                {questions.map((q, index) => (
                  <QuestionCard key={index}>
                    <DragIcon className="drag-handle" />
                    <div className="content">
                      <div className="label">
                        {q.question}
                        {q.required && <span className="required">{TEXT.REQUIRED_BADGE}</span>}
                      </div>
                      <div className="type">{q.type}</div>
                    </div>
                    <DeleteIcon 
                      className="delete" 
                      fontSize="small"
                      onClick={() => handleRemoveQuestion(index)}
                    />
                  </QuestionCard>
                ))}
              </QuestionsList>
            )}
          </PanelBody>
        </Panel>
      </Content>
    </PageContainer>
  );
};

export default ApplicationFormBuilder;
