import { useCallback, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as fbSignOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, firebaseEnabled } from '../firebase'

export type AuthState = 'loading' | 'signed-in' | 'signed-out'

export interface AuthApi {
  /** 'signed-in' is also returned when Firebase isn't configured (nothing to sign into) */
  state: AuthState
  user: User | null
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => void
}

function signInErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'אימייל או סיסמה שגויים'
    case 'auth/invalid-email':
      return 'כתובת אימייל לא תקינה'
    case 'auth/too-many-requests':
      return 'יותר מדי ניסיונות — נסו שוב בעוד כמה דקות'
    case 'auth/operation-not-allowed':
      return 'התחברות באימייל/סיסמה לא מופעלת — הפעילו אותה בקונסולת Firebase (Authentication)'
    case 'auth/configuration-not-found':
      return 'Authentication לא הופעל בפרויקט — היכנסו לקונסולת Firebase, לחצו Authentication ואז Get started'
    case 'auth/network-request-failed':
      return 'בעיית רשת — בדקו את החיבור לאינטרנט'
    default:
      return 'ההתחברות נכשלה — נסו שוב'
  }
}

export function useAuth(): AuthApi {
  const [state, setState] = useState<AuthState>(firebaseEnabled ? 'loading' : 'signed-in')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!auth) return
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setState(u ? 'signed-in' : 'signed-out')
    })
    return unsub
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    if (!auth) return null
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      return null
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      return signInErrorMessage(code)
    }
  }, [])

  const signOut = useCallback(() => {
    if (auth) void fbSignOut(auth)
  }, [])

  return { state, user, signIn, signOut }
}
