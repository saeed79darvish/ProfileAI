import React from 'react';
import { useParams, Link as RouterLink, Navigate } from 'react-router-dom';
import { Box, Container, Typography, Chip, Stack, Button, Divider } from '@mui/material';
import SEO from '../../components/SEO';
import { getPost, POSTS } from './posts';

const BlogPost = () => {
  const { slug } = useParams();
  const post = getPost(slug);

  if (!post) return <Navigate to="/blog" replace />;

  const related = POSTS.filter((p) => p.slug !== slug).slice(0, 2);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#ffffff', py: { xs: 5, md: 8 } }}>
      <SEO
        title={post.title}
        description={post.description}
        path={`/blog/${post.slug}`}
        type="article"
        keywords={post.tags.join(', ')}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          datePublished: post.date,
          dateModified: post.date,
          author: { '@type': 'Organization', name: post.author, url: 'https://www.profilleai.com' },
          publisher: {
            '@type': 'Organization',
            name: 'ProfilleAI',
            logo: { '@type': 'ImageObject', url: 'https://www.profilleai.com/og-image.png' },
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://www.profilleai.com/blog/${post.slug}`,
          },
          image: 'https://www.profilleai.com/og-image.png',
          keywords: post.tags.join(', '),
        }}
      />
      <Container maxWidth="md">
        <Button
          component={RouterLink}
          to="/blog"
          sx={{ mb: 3, color: '#7c3aed', textTransform: 'none' }}
        >
          ← Back to blog
        </Button>

        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {post.tags.map((t) => (
            <Chip key={t} label={t} size="small" sx={{ bgcolor: '#ede9fe', color: '#5b21b6' }} />
          ))}
        </Stack>

        <Typography
          variant="h1"
          sx={{ fontSize: { xs: '2rem', md: '2.75rem' }, fontWeight: 800, mb: 2, lineHeight: 1.2 }}
        >
          {post.title}
        </Typography>

        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
          By {post.author}
          {' · '}
          {new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          {' · '}
          {post.readingMinutes} min read
        </Typography>

        <Box
          sx={{
            fontSize: '1.125rem',
            lineHeight: 1.75,
            color: '#1f2937',
            '& h2': { fontSize: '1.5rem', fontWeight: 700, mt: 5, mb: 2 },
            '& p': { mb: 2.5 },
            '& ul, & ol': { mb: 2.5, pl: 3 },
            '& li': { mb: 1 },
            '& a': { color: '#7c3aed', textDecoration: 'underline' },
            '& strong': { color: '#0b0f19' },
          }}
          dangerouslySetInnerHTML={{ __html: post.body }}
        />

        <Divider sx={{ my: 6 }} />

        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
          Keep reading
        </Typography>
        <Stack spacing={2}>
          {related.map((p) => (
            <Box
              key={p.slug}
              component={RouterLink}
              to={`/blog/${p.slug}`}
              sx={{
                p: 2.5,
                borderRadius: 2,
                border: '1px solid #e5e7eb',
                textDecoration: 'none',
                display: 'block',
                color: 'inherit',
                '&:hover': { borderColor: '#7c3aed', bgcolor: '#faf5ff' },
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0b0f19' }}>
                {p.title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {p.description}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Container>
    </Box>
  );
};

export default BlogPost;
