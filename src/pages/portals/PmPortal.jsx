import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { PortalPlaceholder } from '../../components/PortalPlaceholder'

export default function PmPortal() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  return <PortalPlaceholder label="Project Manager" profile={profile} signOut={signOut} navigate={navigate} color="sky" />
}
