
import {
  Container,
  Paper,
  Box,
  Typography,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  Link,
} from '@mui/material';
import {
  Gavel,
  Shield,
  Person,
  Payment,
  Warning,
  Block,
  Balance,
  Psychology,
} from '@mui/icons-material';
import { LAST_UPDATED, EFFECTIVE_DATE, CONTACT_EMAILS, POLICY } from './constants';

const TermsOfService = () => {

  const Section = ({ number, title, icon, children }) => (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {icon}
        <Typography variant="h5" component="h2" sx={{ fontWeight: 600 }}>
          {number}. {title}
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
            Terms of Service
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last Updated: {LAST_UPDATED} | Effective Date: {EFFECTIVE_DATE}
          </Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 4 }}>
          Please read these Terms of Service carefully before using ProfilleAI. By accessing or using 
          our platform, you agree to be bound by these terms.
        </Alert>

        <Divider sx={{ my: 4 }} />

        {/* Section 1: Acceptance of Terms */}
        <Section number="1" title="Acceptance of Terms" icon={<Gavel color="primary" />}>
          <Typography variant="body1" paragraph>
            By accessing or using ProfilleAI ("Service," "Platform," "we," "us," or "our"), you agree 
            to be bound by these Terms of Service ("Terms"). If you do not agree to all of these Terms, 
            you may not access or use the Service.
          </Typography>
          <Typography variant="body1" paragraph>
            These Terms apply to all visitors, users, and others who access or use the Service, including:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="Candidates seeking employment opportunities" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Recruiters and hiring managers posting jobs and sourcing candidates" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Companies and organizations using our recruitment tools" />
            </ListItem>
          </List>
          <Typography variant="body1">
            We reserve the right to update these Terms at any time. We will notify you of material 
            changes by email or through the platform. Your continued use of the Service after such 
            modifications constitutes your acceptance of the updated Terms.
          </Typography>
        </Section>

        {/* Section 2: User Accounts and Responsibilities */}
        <Section number="2" title="User Accounts and Responsibilities" icon={<Person color="primary" />}>
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Account Creation</Typography>
          <Typography variant="body1" paragraph>
            To use certain features of the Service, you must register for an account. When creating 
            an account, you agree to:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="Provide accurate, current, and complete information" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Maintain and update your information to keep it accurate and current" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Keep your password secure and confidential" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Be at least 18 years of age or the age of majority in your jurisdiction" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Use only one account per person (no duplicate accounts)" />
            </ListItem>
          </List>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Account Security</Typography>
          <Typography variant="body1" paragraph>
            You are responsible for all activities that occur under your account. You must notify us 
            immediately of any unauthorized use of your account or any other breach of security. We 
            cannot and will not be liable for any loss or damage arising from your failure to comply 
            with this security obligation.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>User Responsibilities</Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="Accurate Information" 
                secondary="All profile information, including work experience and qualifications, must be truthful"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Professional Conduct" 
                secondary="Interact with other users in a professional and respectful manner"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Compliance with Laws" 
                secondary="Use the Service in compliance with all applicable laws and regulations"
              />
            </ListItem>
          </List>
        </Section>

        {/* Section 3: AI-Generated Content Disclaimer */}
        <Section number="3" title="AI-Generated Content Disclaimer" icon={<Psychology color="primary" />}>
          <Box sx={{ bgcolor: '#fff3e0', p: 3, borderRadius: 2, mb: 3, border: '1px solid #ffcc80' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Warning sx={{ color: '#e65100' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e65100' }}>
                Important AI Disclosure
              </Typography>
            </Box>
            <Typography variant="body2">
              ProfilleAI uses artificial intelligence (including OpenAI's GPT-4 and Vapi voice AI) to 
              enhance profiles, generate content, and conduct phone screenings. You acknowledge and 
              agree to the following regarding AI-generated content.
            </Typography>
          </Box>

          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>AI Content Ownership and Accuracy</Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="No Guarantee of Accuracy" 
                secondary="AI-generated content may contain errors, inaccuracies, or inappropriate suggestions. You are solely responsible for reviewing and approving all AI-generated content before publication."
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Your Responsibility" 
                secondary="You must review, edit, and approve all AI-enhanced content. Publishing AI content without review is at your own risk."
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Transparency" 
                secondary="AI-generated or AI-enhanced content is labeled with an 'AI-Enhanced' badge on the platform."
              />
            </ListItem>
          </List>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>AI Phone Screening</Typography>
          <Typography variant="body1" paragraph>
            Our AI phone screening feature uses voice AI technology. By participating in AI phone screenings:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="You consent to the recording and transcription of the call" />
            </ListItem>
            <ListItem>
              <ListItemText primary="You understand that AI assessments are advisory and do not guarantee employment outcomes" />
            </ListItem>
            <ListItem>
              <ListItemText primary="You acknowledge that human recruiters will make final hiring decisions" />
            </ListItem>
          </List>
        </Section>

        {/* Section 4: Payment Terms and Refund Policy */}
        <Section number="4" title="Payment Terms and Refund Policy" icon={<Payment color="primary" />}>
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Subscription Plans</Typography>
          <Typography variant="body1" paragraph>
            ProfilleAI offers free and paid subscription plans. Paid plans ("Pro" and "Enterprise") 
            provide access to premium features including enhanced AI capabilities, priority support, 
            and advanced analytics.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Billing</Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="Recurring Payments" 
                secondary="Subscriptions are billed on a recurring basis (monthly or annually) based on your selected plan."
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Automatic Renewal" 
                secondary="Your subscription will automatically renew unless cancelled before the renewal date."
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Price Changes" 
                secondary="We may change subscription prices with 30 days' notice. Price changes will apply to the next billing cycle."
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Payment Processing" 
                secondary="Payments are processed securely through Stripe or PayPal. We do not store full credit card numbers."
              />
            </ListItem>
          </List>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Refund Policy</Typography>
          <Box sx={{ bgcolor: '#e3f2fd', p: 2, borderRadius: 2, mb: 2 }}>
            <Typography variant="body2">
              <strong>24-Hour Money-Back Guarantee:</strong> New subscribers may request a full refund
              within 24 hours of their initial subscription purchase, provided they have not
              consumed any AI credits and have not violated these Terms. Refund eligibility is
              determined at ProfilleAI&rsquo;s reasonable discretion.
            </Typography>
          </Box>
          <List dense>
            <ListItem>
              <ListItemText
                primary="Beyond 24 hours: no refunds by default"
                secondary="Refunds are not issued after the 24-hour window except where required by applicable law or in genuine cases of service failure. Cancellation stops future billing but does not refund past charges."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="AI credits already consumed are non-refundable"
                secondary="Because AI generations, resume tailorings, cover letters, and other credit-based features incur third-party API costs at the time of use, they cannot be refunded once consumed \u2014 even inside the 24-hour window."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="No refunds for accounts that violated the Terms"
                secondary="Accounts suspended or terminated for ToS violations (fraud, spam, abuse, unauthorized scraping, account sharing, etc.) forfeit all refund eligibility."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="No refunds for partial months or unused features"
                secondary="Once a billing period begins we do not prorate refunds for the remaining days, and we do not refund unused credits or unused features."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Annual plan cancellations"
                secondary="Annual subscribers cancelling inside 24 hours of initial purchase receive a full refund (subject to the conditions above). Cancellations after 24 hours retain access until the annual period ends; no partial-year refunds."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Statutory consumer rights"
                secondary="If you are a consumer in the European Union, United Kingdom, or another jurisdiction whose local law grants you a mandatory right of withdrawal or refund, that right applies regardless of this policy. To exercise it, contact billing@profileai.com within the statutory window."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Contact us first \u2014 don\u2019t chargeback"
                secondary="If something goes wrong, please email billing@profileai.com before disputing the charge with your bank. Chargebacks or payment disputes initiated without first giving us a chance to resolve the issue may result in permanent account suspension and forfeiture of any remaining balance."
              />
            </ListItem>
            <ListItem>
              <ListItemText primary="How to request a refund" secondary="Email billing@profileai.com from the address on your account, with your order or ticket reference. We aim to respond within 3 business days." />
            </ListItem>
          </List>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Cancellation</Typography>
          <Typography variant="body1">
            You may cancel your subscription at any time from your Account Settings. Upon cancellation, 
            you will retain access to premium features until the end of your current billing period. 
            After that, your account will revert to the free plan.
          </Typography>
        </Section>

        {/* Section 5: Prohibited Uses */}
        <Section number="5" title="Prohibited Uses" icon={<Block color="primary" />}>
          <Typography variant="body1" paragraph>
            You agree NOT to use the Service to:
          </Typography>
          <List>
            <ListItem>
              <ListItemText 
                primary="❌ Post false, misleading, or fraudulent information"
                secondary="Including fake job postings, fabricated credentials, or impersonation"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="❌ Harass, abuse, or discriminate against other users"
                secondary="Based on race, gender, religion, national origin, disability, or any protected class"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="❌ Spam or send unsolicited messages"
                secondary="Mass messaging, promotional content, or irrelevant job inquiries"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="❌ Scrape, crawl, or harvest user data"
                secondary="Automated collection of profiles, emails, or other information"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="❌ Attempt to bypass security measures"
                secondary="Hacking, exploiting vulnerabilities, or circumventing access controls"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="❌ Post malicious content"
                secondary="Viruses, malware, or links to harmful websites"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="❌ Violate any applicable laws"
                secondary="Including employment, privacy, and anti-discrimination laws"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="❌ Use the platform for non-recruitment purposes"
                secondary="Selling products, promoting unrelated services, or personal ads"
              />
            </ListItem>
          </List>
          <Typography variant="body2" sx={{ mt: 2, fontStyle: 'italic' }}>
            Violation of these terms may result in immediate account suspension or termination 
            without refund.
          </Typography>
        </Section>

        {/* Section 6: Limitation of Liability */}
        <Section number="6" title="Limitation of Liability" icon={<Shield color="primary" />}>
          <Box sx={{ bgcolor: '#fce4ec', p: 2, borderRadius: 2, mb: 3, border: '1px solid #f8bbd9' }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
            </Typography>
          </Box>

          <Typography variant="body1" paragraph>
            To the maximum extent permitted by law:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="No Employment Guarantee" 
                secondary="We do not guarantee that you will find employment or fill job positions through our platform."
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Third-Party Actions" 
                secondary="We are not responsible for the actions, conduct, or content of other users or third parties."
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Service Availability" 
                secondary="We do not guarantee uninterrupted or error-free service. Scheduled maintenance and unexpected outages may occur."
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="AI Limitations" 
                secondary="AI-generated content and assessments are provided for informational purposes and should not be relied upon as the sole basis for employment decisions."
              />
            </ListItem>
          </List>

          <Typography variant="body1" sx={{ mt: 2 }}>
            IN NO EVENT SHALL PROFILEAI BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, 
            OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE 
            OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE 
            (12) MONTHS PRECEDING THE CLAIM.
          </Typography>
        </Section>

        {/* Section 7: Dispute Resolution */}
        <Section number="7" title="Dispute Resolution" icon={<Balance color="primary" />}>
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Informal Resolution</Typography>
          <Typography variant="body1" paragraph>
            Before filing any formal legal claim, you agree to contact us at{' '}
            <Link href="mailto:legal@profileai.com">legal@profileai.com</Link> to attempt to resolve 
            the dispute informally. We will work in good faith to resolve any issues within 30 days.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Arbitration Agreement</Typography>
          <Typography variant="body1" paragraph>
            If informal resolution is unsuccessful, any dispute arising from these Terms or your use 
            of the Service shall be resolved through binding arbitration administered by the American 
            Arbitration Association (AAA) under its Consumer Arbitration Rules.
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="Arbitration shall take place in San Francisco, California, or remotely at your option" />
            </ListItem>
            <ListItem>
              <ListItemText primary="The arbitrator's decision shall be final and binding" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Each party shall bear their own costs, with filing fees split equally" />
            </ListItem>
          </List>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Class Action Waiver</Typography>
          <Typography variant="body1" paragraph>
            You agree that any dispute resolution proceedings will be conducted only on an individual 
            basis and not in a class, consolidated, or representative action.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Governing Law</Typography>
          <Typography variant="body1">
            These Terms shall be governed by and construed in accordance with the laws of the State 
            of California, without regard to its conflict of law provisions.
          </Typography>
        </Section>

        {/* Section 8: Additional Terms */}
        <Section number="8" title="Additional Terms" icon={<Gavel color="primary" />}>
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Intellectual Property</Typography>
          <Typography variant="body1" paragraph>
            The Service and its original content, features, and functionality are owned by ProfilleAI 
            and are protected by copyright, trademark, and other intellectual property laws. You retain 
            ownership of content you submit but grant us a license to use it for providing the Service.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Termination</Typography>
          <Typography variant="body1" paragraph>
            We may terminate or suspend your account immediately, without prior notice, for any breach 
            of these Terms. Upon termination, your right to use the Service will cease immediately.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Severability</Typography>
          <Typography variant="body1" paragraph>
            If any provision of these Terms is held to be invalid or unenforceable, the remaining 
            provisions will continue in full force and effect.
          </Typography>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>Contact Us</Typography>
          <Typography variant="body1">
            If you have questions about these Terms, please contact us at:
          </Typography>
          <Box sx={{ bgcolor: '#f5f5f5', p: 2, borderRadius: 2, mt: 2 }}>
            <Typography variant="body2">
              <strong>Email:</strong>{' '}
              <Link href="mailto:legal@profileai.com">legal@profileai.com</Link>
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              <strong>Support:</strong>{' '}
              <Link href="mailto:support@profileai.com">support@profileai.com</Link>
            </Typography>
          </Box>
        </Section>

        <Divider sx={{ my: 4 }} />

        {/* Footer */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" paragraph>
            By using ProfilleAI, you acknowledge that you have read, understood, and agree to be 
            bound by these Terms of Service.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            These Terms were last updated on {LAST_UPDATED}.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Link href="/privacy" sx={{ mr: 2 }}>Privacy Policy</Link>
            <Link href="mailto:legal@profileai.com">Contact Legal</Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default TermsOfService;
