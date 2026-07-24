import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface MagicLinkEmailProps {
  siteName: string
  token?: string
}

export const MagicLinkEmail = ({
  siteName,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {siteName} access code{token ? `: ${token}` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>HAYAS MARKETING</Text>
        <Heading style={h1}>Your access code</Heading>
        <Text style={text}>
          Enter this 6-digit code in the {siteName} sign-in screen to continue.
          This code expires in 10 minutes.
        </Text>

        {token ? (
          <Section style={codeWrap}>
            <Text style={codeStyle}>{token}</Text>
          </Section>
        ) : null}

        <Text style={footer}>
          If you didn't request this, you can safely ignore this email — no
          action will be taken on your account.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const teal = '#0F5D5F'

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container = {
  maxWidth: '480px',
  padding: '32px 28px',
  margin: '0 auto',
}
const brand = {
  fontSize: '11px',
  letterSpacing: '0.18em',
  fontWeight: 700 as const,
  color: teal,
  margin: '0 0 24px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 600 as const,
  color: '#0f172a',
  margin: '0 0 12px',
}
const text = {
  fontSize: '14px',
  color: '#475569',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const smallText = {
  fontSize: '13px',
  color: '#64748b',
  lineHeight: '1.6',
  margin: '20px 0 12px',
}
const codeWrap = {
  backgroundColor: '#f1f5f9',
  border: `1px solid ${teal}22`,
  borderRadius: '10px',
  padding: '18px 20px',
  textAlign: 'center' as const,
  margin: '0 0 8px',
}
const codeStyle = {
  fontFamily: '"SF Mono", Menlo, Consolas, monospace',
  fontSize: '30px',
  fontWeight: 700 as const,
  letterSpacing: '0.35em',
  color: teal,
  margin: 0,
}
const hr = {
  borderColor: '#e2e8f0',
  margin: '28px 0 4px',
}
const button = {
  backgroundColor: teal,
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600 as const,
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: '#94a3b8',
  lineHeight: '1.6',
  margin: '28px 0 0',
}
