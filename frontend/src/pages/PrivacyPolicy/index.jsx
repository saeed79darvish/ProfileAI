
import {
  Container,
  Paper,
  Box,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Link,
} from '@mui/material';
import {
  Security,
  Person,
  Storage,
  Cookie,
  Email,
  Phone,
  Delete,
  Download,
  CloudUpload,
  Payment,
  Psychology,
} from '@mui/icons-material';
import { LAST_UPDATED, CONTACT_EMAILS } from './constants';

const PrivacyPolicy = () => {

  const Section = ({ title, icon, children }) => (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {icon}
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>
      {children}
    </Box>
  );

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, borderRadius: 3, border: '1px solid #e0e0e0' }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h3" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            Privacy Policy
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last Updated: {LAST_UPDATED}
          </Typography>
        </Box>

        <Typography variant="body1" paragraph>
          ProfileAI ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
          explains how we collect, use, disclose, and safeguard your information when you use our 
          platform for professional profile creation and job recruitment.
        </Typography>

        <Divider sx={{ my: 4 }} />

        {/* Section 1: Data We Collect */}
        <Section title="1. Information We Collect" icon={<Storage color="primary" />}>
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Profile Information</Typography>
          <List dense>
            <ListItem>
              <ListItemIcon><Person fontSize="small" /></ListItemIcon>
              <ListItemText primary="Name, email address, phone number, and professional title" />
            </ListItem>
            <ListItem>
              <ListItemIcon><Person fontSize="small" /></ListItemIcon>
              <ListItemText primary="Work experience, education history, skills, and certifications" />
            </ListItem>
            <ListItem>
              <ListItemIcon><Person fontSize="small" /></ListItemIcon>
              <ListItemText primary="Resume/CV uploads and portfolio links" />
            </ListItem>
            <ListItem>
              <ListItemIcon><Person fontSize="small" /></ListItemIcon>
              <ListItemText primary="Profile photos and professional headshots" />
            </ListItem>
          </List>

          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Usage Data</Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="Device information (browser type, IP address, device type)" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Pages visited, features used, and time spent on the platform" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Job applications, saved jobs, and search queries" />
            </ListItem>
          </List>

          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>AI Interaction Data</Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="Text inputs provided for AI enhancement (profile summaries, descriptions)" />
            </ListItem>
            <ListItem>
              <ListItemText primary="AI-generated content and your modifications to it" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Phone screening call recordings and transcripts (with your consent)" />
            </ListItem>
          </List>
        </Section>

        {/* Section 2: AI Usage Disclosure */}
        <Section title="2. How We Use Artificial Intelligence" icon={<Psychology color="primary" />}>
          <Box sx={{ bgcolor: '#fff3e0', p: 2, borderRadius: 2, mb: 2, border: '1px solid #ffcc80' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#e65100', mb: 1 }}>
              ⚠️ Important AI Disclosure
            </Typography>
            <Typography variant="body2">
              ProfileAI uses OpenAI's GPT-4 and other AI models to enhance your professional profile 
              and provide intelligent features. By using our AI-powered features, you acknowledge that 
              your data may be processed by these AI systems.
            </Typography>
          </Box>

          <Typography variant="body1" paragraph>
            We use AI technology for:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="Profile Enhancement" 
                secondary="Improving profile summaries, project descriptions, and professional content"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Smart Job Matching" 
                secondary="Analyzing your profile to recommend relevant job opportunities"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="AI Phone Screening" 
                secondary="Conducting initial interview calls with AI agents (Vapi technology)"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Skills Suggestions" 
                secondary="Recommending skills based on your experience and industry trends"
              />
            </ListItem>
          </List>

          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            Note: AI-generated content is marked with an "AI-Enhanced" badge. You always have the 
            option to edit or reject AI suggestions.
          </Typography>
        </Section>

        {/* Section 3: Data Storage & Security */}
        <Section title="3. How We Store and Protect Your Data" icon={<Security color="primary" />}>
          <Typography variant="body1" paragraph>
            We implement industry-standard security measures to protect your personal information:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="All data is encrypted in transit (TLS/SSL) and at rest (AES-256)" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Passwords are hashed using bcrypt with secure salt rounds" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Access to personal data is restricted to authorized personnel only" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Regular security audits and vulnerability assessments" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Data is stored on secure cloud infrastructure (PostgreSQL databases)" />
            </ListItem>
          </List>
        </Section>

        {/* Section 4: Third-Party Services */}
        <Section title="4. Third-Party Services" icon={<CloudUpload color="primary" />}>
          <Typography variant="body1" paragraph>
            We use trusted third-party services to provide our platform functionality:
          </Typography>

          <Box sx={{ display: 'grid', gap: 2, mt: 2 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Payment color="primary" fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Stripe</Typography>
              </Box>
              <Typography variant="body2">
                Payment processing for subscriptions. Stripe handles all payment card data 
                securely and is PCI-DSS compliant. We never store your full credit card numbers.
              </Typography>
              <Link href="https://stripe.com/privacy" target="_blank" rel="noopener" variant="body2">
                Stripe Privacy Policy →
              </Link>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CloudUpload color="primary" fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Cloudinary</Typography>
              </Box>
              <Typography variant="body2">
                Image storage and optimization for profile pictures and uploads. Images are 
                stored securely with access controls.
              </Typography>
              <Link href="https://cloudinary.com/privacy" target="_blank" rel="noopener" variant="body2">
                Cloudinary Privacy Policy →
              </Link>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Phone color="primary" fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Vapi</Typography>
              </Box>
              <Typography variant="body2">
                AI-powered phone screening calls. Call recordings and transcripts are processed 
                to provide interview feedback. You will be informed before any call is recorded.
              </Typography>
              <Link href="https://vapi.ai/privacy" target="_blank" rel="noopener" variant="body2">
                Vapi Privacy Policy →
              </Link>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Psychology color="primary" fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>OpenAI</Typography>
              </Box>
              <Typography variant="body2">
                AI text generation for profile enhancement and smart features. Text you submit 
                for enhancement may be processed by OpenAI's API. OpenAI does not use API data 
                to train their models.
              </Typography>
              <Link href="https://openai.com/privacy" target="_blank" rel="noopener" variant="body2">
                OpenAI Privacy Policy →
              </Link>
            </Paper>
          </Box>
        </Section>

        {/* Section 5: Your Rights */}
        <Section title="5. Your Rights" icon={<Person color="primary" />}>
          <Typography variant="body1" paragraph>
            You have the following rights regarding your personal data:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon><Download /></ListItemIcon>
              <ListItemText 
                primary="Right to Access" 
                secondary="Request a copy of all personal data we hold about you"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Delete /></ListItemIcon>
              <ListItemText 
                primary="Right to Deletion" 
                secondary="Request permanent deletion of your account and all associated data"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Person /></ListItemIcon>
              <ListItemText 
                primary="Right to Rectification" 
                secondary="Update or correct your personal information at any time"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Person /></ListItemIcon>
              <ListItemText 
                primary="Right to Data Portability" 
                secondary="Export your data in a machine-readable format (JSON)"
              />
            </ListItem>
          </List>
          <Typography variant="body2" sx={{ mt: 2 }}>
            To exercise these rights, please contact us at{' '}
            <Link href="mailto:privacy@profileai.com">privacy@profileai.com</Link> or use the 
            Account Settings page in your dashboard.
          </Typography>
        </Section>

        {/* Section 6: Cookies */}
        <Section title="6. Cookie Usage" icon={<Cookie color="primary" />}>
          <Typography variant="body1" paragraph>
            We use cookies and similar technologies to:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="Keep you logged in (authentication cookies)" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Remember your preferences and settings" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Analyze platform usage to improve our services" />
            </ListItem>
          </List>
          <Typography variant="body2">
            You can control cookie preferences through your browser settings. Disabling cookies 
            may affect some platform functionality.
          </Typography>
        </Section>

        {/* Section 7: Contact */}
        <Section title="7. Contact Information" icon={<Email color="primary" />}>
          <Typography variant="body1" paragraph>
            If you have questions about this Privacy Policy or our data practices, please contact us:
          </Typography>
          <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 2 }}>
            <Typography variant="body2">
              <strong>Email:</strong>{' '}
              <Link href="mailto:privacy@profileai.com">privacy@profileai.com</Link>
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Data Protection Officer:</strong>{' '}
              <Link href="mailto:dpo@profileai.com">dpo@profileai.com</Link>
            </Typography>
          </Box>
        </Section>

        <Divider sx={{ my: 4 }} />

        {/* Footer */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            This privacy policy is effective as of {LAST_UPDATED}. We may update this policy 
            from time to time. We will notify you of any material changes by email or through 
            the platform.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default PrivacyPolicy;
