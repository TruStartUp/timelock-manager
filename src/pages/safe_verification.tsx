import React from 'react'
import Layout from '@/components/common/Layout'
import SafeHashVerificationView from '@/components/safe_verification/SafeHashVerificationView'

const SafeVerificationPage: React.FC = () => {
  return (
    <Layout>
      <SafeHashVerificationView />
    </Layout>
  )
}

export default SafeVerificationPage
