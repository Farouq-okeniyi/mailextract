import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { LayoutDashboard, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/Card';
import { fetchApi } from '../../utils/api';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Set initial mode based on route or default to signin
  const [isSignUp, setIsSignUp] = useState(location.pathname === '/signup');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-redirect to dashboard if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const user = localStorage.getItem('user');
    if (token && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    setIsSignUp(location.pathname === '/signup');
  }, [location.pathname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Instant Signup -> Auto Login -> Directly to Dashboard
        const data = await fetchApi('/auth/users/sighup', {
          method: 'POST',
          body: JSON.stringify({ username: username.trim(), email: email.trim(), password }),
        });

        if (data.accessToken && data.user) {
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('user', JSON.stringify(data.user));
          toast.success('Welcome! Your account is ready.');
          navigate('/dashboard');
        } else {
          // Fallback auto-signin if signup didn't return tokens
          const signinData = await fetchApi('/auth/users/signin', {
            method: 'POST',
            body: JSON.stringify({ email: email.trim(), password }),
          });
          localStorage.setItem('accessToken', signinData.accessToken);
          localStorage.setItem('user', JSON.stringify(signinData.user));
          toast.success('Welcome to MailExtract!');
          navigate('/dashboard');
        }
      } else {
        // Direct Signin -> Straight to Dashboard
        const data = await fetchApi('/auth/users/signin', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), password }),
        });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        toast.success('Signed in successfully!');
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchApi('/auth/users/google-login', {
        method: 'POST',
        body: JSON.stringify({ token: credentialResponse.credential }),
      });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success('Welcome to MailExtract!');
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6 font-sans">
      <Card className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 p-2">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center mb-3 shadow-md shadow-blue-500/25 text-white">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-extrabold text-slate-900 tracking-tight">
            {isSignUp ? 'Get Started with MailExtract' : 'Welcome to MailExtract'}
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            {isSignUp 
              ? 'Instant financial extraction and bank alert reports' 
              : 'Sign in to access your financial dashboard'}
          </p>

          {/* Quick Mode Toggle Pills */}
          <div className="flex bg-slate-100 p-1 rounded-xl mt-4">
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                !isSignUp ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setError(''); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                isSignUp ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Create Account
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          
          {/* 1-CLICK GOOGLE SIGN IN (TOP PRIORITY) */}
          <div className="space-y-2">
            <div className="flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google Authentication Failed')}
                theme="outline"
                size="large"
                shape="rectangular"
                width="100%"
                text={isSignUp ? 'signup_with' : 'signin_with'}
              />
            </div>
            
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-slate-400 font-medium">Or continue with email</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-600 p-2.5 rounded-xl text-xs text-center font-medium">
                {error}
              </div>
            )}

            {isSignUp && (
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-[34px] text-slate-400" />
                <Input
                  label="Username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9 text-xs rounded-xl"
                  required={isSignUp}
                  minLength={2}
                />
              </div>
            )}

            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-[34px] text-slate-400" />
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 text-xs rounded-xl"
                required
              />
            </div>

            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-[34px] text-slate-400" />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 text-xs rounded-xl"
                required
                minLength={6}
              />
            </div>

            <Button 
              type="submit" 
              fullWidth 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
            >
              {loading ? (
                'Please wait...'
              ) : isSignUp ? (
                <>
                  Create Account & Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center pt-0 pb-3">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="text-xs text-slate-500 hover:text-blue-600 transition-colors font-medium cursor-pointer"
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
};
