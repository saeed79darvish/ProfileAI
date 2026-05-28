import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Container, Typography, Card, CardContent, Chip, Stack } from '@mui/material';
import SEO from '../../components/SEO';
import { POSTS } from './posts';

const BlogIndex = () => {
  const sorted = [...POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', py: { xs: 6, md: 10 } }}>
      <SEO
        title="Blog — AI Career, Resume & Negotiation Insights"
        description="Guides on AI resume tailoring, auto-applying to jobs, salary negotiation, and how candidates and recruiters win with AI."
        path="/blog"
        keywords="AI resume blog, job search AI, ATS optimization, salary negotiation tips, ApplyPilot guide"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'ProfilleAI Blog',
          url: 'https://www.profilleai.com/blog',
          blogPost: sorted.map((p) => ({
            '@type': 'BlogPosting',
            headline: p.title,
            description: p.description,
            datePublished: p.date,
            author: { '@type': 'Organization', name: p.author },
            url: `https://www.profilleai.com/blog/${p.slug}`,
          })),
        }}
      />
      <Container maxWidth="md">
        <Typography variant="overline" sx={{ color: '#7c3aed', fontWeight: 700, letterSpacing: 3 }}>
          PROFILLEAI BLOG
        </Typography>
        <Typography variant="h2" sx={{ fontWeight: 800, mb: 1, fontSize: { xs: '2rem', md: '3rem' } }}>
          AI career insights, plainly written.
        </Typography>
        <Typography variant="h6" sx={{ color: 'text.secondary', mb: 6, fontWeight: 400 }}>
          How to use AI to land better jobs, write sharper resumes, and negotiate offers worth more.
        </Typography>

        <Stack spacing={3}>
          {sorted.map((post) => (
            <Card
              key={post.slug}
              component={RouterLink}
              to={`/blog/${post.slug}`}
              sx={{
                textDecoration: 'none',
                borderRadius: 3,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 },
              }}
            >
              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                  {post.tags.map((t) => (
                    <Chip key={t} label={t} size="small" sx={{ bgcolor: '#ede9fe', color: '#5b21b6' }} />
                  ))}
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: '#0b0f19' }}>
                  {post.title}
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
                  {post.description}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {' · '}{post.readingMinutes} min read
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Container>
    </Box>
  );
};

export default BlogIndex;
