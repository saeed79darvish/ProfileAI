import { Link as RouterLink } from 'react-router-dom';
import { Container, Box, Typography, Button } from '@mui/material';
import { SentimentDissatisfied, Home as HomeIcon } from '@mui/icons-material';

const NotFound = () => (
  <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
    <Box sx={{ textAlign: 'center' }}>
      <SentimentDissatisfied sx={{ fontSize: 96, color: 'primary.main', mb: 2 }} />
      <Typography variant="h2" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
        404
      </Typography>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 2 }}>
        Page not found
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 480, mx: 'auto' }}>
        The page you’re looking for doesn’t exist or has been moved. Check the URL, or head back home.
      </Typography>
      <Button
        component={RouterLink}
        to="/"
        variant="contained"
        size="large"
        startIcon={<HomeIcon />}
      >
        Go home
      </Button>
    </Box>
  </Container>
);

export default NotFound;
