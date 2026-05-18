import {
  Container, Box, Typography, Grid, Skeleton, Alert, Button,
  ToggleButtonGroup, ToggleButton, Chip, Fab
} from '@mui/material';
import {
  PageContainer,
  HeaderSection,
  Title,
  Subtitle,
  FiltersRow,
  ContentWrapper,
  PollsList,
  EmptyState,
  LoadingGrid,
  CategoryChip,
  CreateFab,
  StatsBar
} from './styled';
import { CATEGORIES, TEXT, PAGINATION } from './constants';

const PollsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const [sort, setSort] = useState(searchParams.get('sort') || 'recent');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [status, setStatus] = useState(searchParams.get('status') || 'active');
  
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    fetchPolls();
  }, [sort, category, status]);

  const fetchPolls = async () => {
    try {
      setLoading(true);
      const params = { sort, status, page: 1, limit: PAGINATION.DEFAULT_LIMIT };
      if (category !== 'all') {
        params.category = category;
      }
      
      const response = await pollsAPI.getAll(params);
      setPolls(response.data.polls || []);
      setPagination(response.data.pagination || { page: 1, total: 0, pages: 0 });
    } catch (err) {
      console.error('Error fetching polls:', err);
      setError(TEXT.ERROR_LOADING);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (event, newSort) => {
    if (newSort) {
      setSort(newSort);
      setSearchParams({ sort: newSort, category, status });
    }
  };

  const handleCategoryChange = (newCategory) => {
    setCategory(newCategory);
    setSearchParams({ sort, category: newCategory, status });
  };

  const handleStatusChange = (event, newStatus) => {
    if (newStatus) {
      setStatus(newStatus);
      setSearchParams({ sort, category, status: newStatus });
    }
  };

  const handlePollVote = (updatedPoll) => {
    setPolls(prev => prev.map(p => 
      p.id === updatedPoll.id ? updatedPoll : p
    ));
  };

  const handlePollCreated = (newPoll) => {
    setPolls(prev => [newPoll, ...prev]);
    setShowCreateModal(false);
  };

  const totalVotes = polls.reduce((sum, p) => {
    const pollVotes = p.options?.reduce((s, opt) => s + (opt.votes || 0), 0) || 0;
    return sum + pollVotes;
  }, 0);
  
  const hotTakes = polls.filter(p => p.isHotTake).length;

  return (
    <PageContainer>
      <HeaderSection>
        <Title>{TEXT.PAGE_TITLE}</Title>
        <Subtitle>
          {TEXT.PAGE_SUBTITLE}
        </Subtitle>
        
        <StatsBar>
          <div className="stat">
            <div className="value">{pagination.total || polls.length}</div>
            <div className="label">{TEXT.TOTAL_POLLS}</div>
          </div>
          <div className="stat">
            <div className="value">{totalVotes}</div>
            <div className="label">{TEXT.TOTAL_VOTES}</div>
          </div>
          <div className="stat">
            <div className="value">{hotTakes}</div>
            <div className="label">{TEXT.HOT_TAKES}</div>
          </div>
        </StatsBar>
      </HeaderSection>

      <ContentWrapper>
        <FiltersRow>
          <ToggleButtonGroup
            value={sort}
            exclusive
            onChange={handleSortChange}
            size="small"
          >
            <ToggleButton value="recent">
              <AccessTimeIcon sx={{ fontSize: 16, mr: 0.5 }} />
              {TEXT.SORT_RECENT}
            </ToggleButton>
            <ToggleButton value="trending">
              <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5 }} />
              {TEXT.SORT_TRENDING}
            </ToggleButton>
            <ToggleButton value="hot">
              <LocalFireDepartmentIcon sx={{ fontSize: 16, mr: 0.5 }} />
              {TEXT.SORT_HOT}
            </ToggleButton>
          </ToggleButtonGroup>
          
          <ToggleButtonGroup
            value={status}
            exclusive
            onChange={handleStatusChange}
            size="small"
          >
            <ToggleButton value="active">{TEXT.STATUS_ACTIVE}</ToggleButton>
            <ToggleButton value="ended">{TEXT.STATUS_ENDED}</ToggleButton>
          </ToggleButtonGroup>
        </FiltersRow>
        
        <FiltersRow>
          {CATEGORIES.map(cat => (
            <CategoryChip
              key={cat.value}
              label={`${cat.icon} ${cat.label}`}
              onClick={() => handleCategoryChange(cat.value)}
              color={category === cat.value ? 'primary' : 'default'}
              variant={category === cat.value ? 'filled' : 'outlined'}
            />
          ))}
        </FiltersRow>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <LoadingGrid>
            {[1, 2, 3].map(i => (
              <Skeleton 
                key={i} 
                variant="rounded" 
                height={200} 
                sx={{ borderRadius: 3 }} 
              />
            ))}
          </LoadingGrid>
        ) : polls.length === 0 ? (
          <EmptyState>
            <div className="icon">📊</div>
            <div className="title">{TEXT.NO_POLLS}</div>
            <div className="subtitle">
              {category !== 'all' 
                ? TEXT.EMPTY_CATEGORY(category)
                : TEXT.EMPTY_DEFAULT
              }
            </div>
            {user && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowCreateModal(true)}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  textTransform: 'none',
                  fontWeight: 600,
                  borderRadius: 2
                }}
              >
                {TEXT.CREATE_POLL}
              </Button>
            )}
          </EmptyState>
        ) : (
          <PollsList>
            {polls.map(poll => (
              <PollCard
                key={poll.id}
                poll={poll}
                onVote={handlePollVote}
              />
            ))}
          </PollsList>
        )}
      </ContentWrapper>

      {user && (
        <CreateFab color="primary" onClick={() => setShowCreateModal(true)}>
          <AddIcon />
        </CreateFab>
      )}

      <CreatePollModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPollCreated={handlePollCreated}
      />
    </PageContainer>
  );
};

export default PollsPage;
