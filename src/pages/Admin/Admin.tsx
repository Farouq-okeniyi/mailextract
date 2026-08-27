import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CheckCircle2, 
  Clock, 
  Mail, 
  Send, 
  X, 
  Users, 
  Radio, 
  ShieldCheck, 
  UserX, 
  Search, 
  ChevronDown, 
  Check, 
  ExternalLink,
  ShieldAlert,
  Inbox,
  UserCheck
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { fetchApi } from '../../utils/api';
import { config } from '../../config/env';
import toast from 'react-hot-toast';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Modals state
  const [userToApprove, setUserToApprove] = useState<{id: string, email: string} | null>(null);
  const [userToUnapprove, setUserToUnapprove] = useState<{id: string, email: string} | null>(null);

  // Email Composer state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [audience, setAudience] = useState<'all' | 'approved' | 'pending' | 'not_requested' | 'specific'>('all');
  const [emailTo, setEmailTo] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailTitle, setEmailTitle] = useState('MailExtract Announcement');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (currentUser.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchUsers();
  }, [navigate]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/admin/users');
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  // Segment counts
  const approvedCount = users.filter(u => u.isApproved).length;
  const pendingCount = users.filter(u => !u.isApproved && u.accessRequested).length;
  const notRequestedCount = users.filter(u => !u.isApproved && !u.accessRequested).length;
  const totalCount = users.length;

  // Search filtered users
  const filteredUsers = users.filter(u => 
    (u.username || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearchTerm.toLowerCase())
  );
  const selectedUser = users.find(u => u.email === emailTo);

  const executeApprove = async () => {
    if (!userToApprove) return;
    try {
      await fetchApi(`/admin/users/${userToApprove.id}/approve`, { method: 'PATCH' });
      setUsers(prev => prev.map(u => u.id === userToApprove.id ? { ...u, isApproved: true } : u));
      toast.success('User approved. Notification email dispatched.');
      setUserToApprove(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve user');
    }
  };

  const executeUnapprove = async () => {
    if (!userToUnapprove) return;
    try {
      await fetchApi(`/admin/users/${userToUnapprove.id}/unapprove`, { method: 'PATCH' });
      setUsers(prev => prev.map(u => u.id === userToUnapprove.id ? { ...u, isApproved: false, accessRequested: false } : u));
      toast.success('User access revoked.');
      setUserToUnapprove(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to unapprove user');
    }
  };

  const handleUnapprove = (userId: string, userEmail: string) => {
    setUserToUnapprove({ id: userId, email: userEmail });
  };

  const handleApprove = (userId: string, userEmail: string) => {
    setUserToApprove({ id: userId, email: userEmail });
  };

  const openEmailComposer = (targetEmail?: string, initialAudience: 'all' | 'approved' | 'pending' | 'not_requested' | 'specific' = 'all') => {
    if (targetEmail) {
      setAudience('specific');
      setEmailTo(targetEmail);
    } else {
      setAudience(initialAudience);
      setEmailTo('');
    }
    setUserSearchTerm('');
    setIsDropdownOpen(false);
    setEmailSubject('');
    setEmailTitle('System Notification');
    setEmailMessage('');
    setShowEmailModal(true);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailSubject.trim() || !emailMessage.trim()) {
      toast.error('Please provide a subject line and message.');
      return;
    }
    if (audience === 'specific' && !emailTo.trim()) {
      toast.error('Please select a recipient user from the list.');
      return;
    }

    setSendingEmail(true);
    try {
      const payload = {
        audience,
        broadcast: audience === 'all',
        to: audience === 'specific' ? emailTo.trim() : undefined,
        subject: emailSubject.trim(),
        title: emailTitle.trim(),
        message: emailMessage.trim(),
      };

      const res = await fetchApi('/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      toast.success(res.message || 'Email successfully dispatched.');
      setShowEmailModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  if (currentUser.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-900">
      
      {/* Email Composer Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-xl w-full p-6 sm:p-7 scale-in-center max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/80">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">Email Dispatcher</h3>
                  <p className="text-xs text-slate-500">Send custom messages or targeted broadcasts</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-4">
              
              {/* Target Audience Segment Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Target Audience
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  
                  <button
                    type="button"
                    onClick={() => { setAudience('all'); setEmailTo(''); }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      audience === 'all' 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" /> All Users ({totalCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAudience('approved'); setEmailTo(''); }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      audience === 'approved' 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Approved ({approvedCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAudience('pending'); setEmailTo(''); }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      audience === 'pending' 
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" /> Pending ({pendingCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAudience('not_requested'); setEmailTo(''); }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      audience === 'not_requested' 
                        ? 'bg-slate-700 text-white border-slate-700 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <UserX className="w-3.5 h-3.5" /> Unrequested ({notRequestedCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => { setAudience('specific'); setIsDropdownOpen(true); }}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer sm:col-span-2 ${
                      audience === 'specific' 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" /> Specific User
                  </button>
                </div>
              </div>

              {/* Searchable User Selector Combobox */}
              {audience === 'specific' && (
                <div className="relative">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Select Recipient
                  </label>
                  
                  <div 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full min-h-[42px] px-3 py-2 bg-white border border-slate-200 rounded-xl cursor-pointer flex items-center justify-between hover:border-indigo-400 transition-colors shadow-sm"
                  >
                    {selectedUser ? (
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                          {selectedUser.username.slice(0, 2)}
                        </div>
                        <div className="truncate text-xs">
                          <span className="font-semibold text-slate-900">{selectedUser.username}</span>{' '}
                          <span className="text-slate-500">({selectedUser.email})</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Search recipient name or email...</span>
                    )}
                    <div className="flex items-center gap-1.5 text-slate-400">
                      {selectedUser && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setEmailTo(''); setIsDropdownOpen(true); }}
                          className="p-1 hover:text-slate-700 rounded-md"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                      <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Type to filter users..."
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-50 text-xs">
                        {filteredUsers.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-xs">
                            No users match "{userSearchTerm}"
                          </div>
                        ) : (
                          filteredUsers.map(u => (
                            <div
                              key={u.id || u.email}
                              onClick={() => {
                                setEmailTo(u.email);
                                setIsDropdownOpen(false);
                                setUserSearchTerm('');
                              }}
                              className={`p-2.5 flex items-center justify-between hover:bg-indigo-50/50 cursor-pointer transition-colors ${
                                emailTo === u.email ? 'bg-indigo-50/70 text-indigo-900 font-medium' : 'text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 overflow-hidden">
                                <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                                  {u.username.slice(0, 2)}
                                </div>
                                <div className="truncate">
                                  <div className="font-semibold text-slate-900 text-xs">{u.username}</div>
                                  <div className="text-[11px] text-slate-500">{u.email}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                  u.isApproved 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : u.accessRequested 
                                    ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                    : 'bg-slate-50 text-slate-600 border-slate-200'
                                }`}>
                                  {u.isApproved ? 'Approved' : u.accessRequested ? 'Pending' : 'Unrequested'}
                                </span>
                                {emailTo === u.email && (
                                  <Check className="w-4 h-4 text-indigo-600" />
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Subject Line
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Important Service Update"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  required
                  className="text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Header Title
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Platform Notice"
                  value={emailTitle}
                  onChange={(e) => setEmailTitle(e.target.value)}
                  className="text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Message Content
                </label>
                <textarea
                  rows={5}
                  placeholder="Type your message here..."
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  required
                  className="w-full p-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y transition-all"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEmailModal(false)}
                  className="text-xs px-4"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={sendingEmail}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer px-4"
                >
                  {sendingEmail ? (
                    'Dispatching...'
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Send Message
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Confirmation Modal */}
      {userToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-lg w-full p-7 scale-in-center">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Authorize User Access</h3>
                <p className="text-xs text-slate-500">Google Cloud Console configuration check</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Please ensure <strong className="text-slate-900">{userToApprove.email}</strong> is added to your <strong>Google Cloud Console Test Users</strong> before approving.
            </p>
            
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-6">
              <a 
                href={config.googleCloudConsoleUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center justify-between"
              >
                <span>Google Cloud Console &bull; OAuth Consent Screen</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex justify-end gap-2.5">
              <Button variant="outline" size="sm" onClick={() => setUserToApprove(null)} className="text-xs">
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={executeApprove}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm cursor-pointer"
              >
                Confirm & Approve Access
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Revocation Confirmation Modal */}
      {userToUnapprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-lg w-full p-7 scale-in-center">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">Revoke User Access</h3>
                <p className="text-xs text-slate-500">Disable extraction capabilities</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              This will revoke extraction permissions for <strong className="text-slate-900">{userToUnapprove.email}</strong> and send an automated status notification.
            </p>
            
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 mb-6">
              <a 
                href={config.googleCloudConsoleUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center justify-between"
              >
                <span>Remove user from Google Cloud Console</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex justify-end gap-2.5">
              <Button variant="outline" size="sm" onClick={() => setUserToUnapprove(null)} className="text-xs">
                Cancel
              </Button>
              <Button 
                size="sm" 
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm cursor-pointer"
                onClick={executeUnapprove}
              >
                Revoke Access
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">MailExtract</span>
                <span className="text-[11px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                  Admin Console
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Button 
                onClick={() => openEmailComposer()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" /> Compose Email
              </Button>
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="flex items-center text-xs text-slate-700">
                  <LayoutDashboard className="h-4 w-4 mr-1.5" />
                  Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Page Title and Stat Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">User Management</h1>
            <p className="text-xs text-slate-500 mt-1">Review access authorizations, manage accounts, and broadcast notifications.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span> Total: {totalCount}
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-emerald-700 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Approved: {approvedCount}
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-amber-700 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Pending: {pendingCount}
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span> Unrequested: {notRequestedCount}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-700 p-4 rounded-xl mb-6 border border-rose-200 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Users Table Card */}
        <Card className="shadow-sm border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-6">User Account</th>
                  <th className="py-3.5 px-6">Role</th>
                  <th className="py-3.5 px-6">Access State</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      Loading user accounts...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <Inbox className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      No registered users found.
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase border border-slate-200">
                            {user.username.slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{user.username}</div>
                            <div className="text-slate-500 text-[11px]">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold capitalize ${
                          user.role === 'admin' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        {user.isApproved ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </span>
                        ) : user.accessRequested ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[11px]">
                            <Clock className="w-3 h-3" /> Pending Authorization
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-slate-400 text-[11px]">
                            Not Requested
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEmailComposer(user.email, 'specific')}
                            className="text-indigo-600 border-slate-200 hover:bg-indigo-50 text-xs py-1 px-2.5 h-8 cursor-pointer font-medium"
                            title={`Send direct email to ${user.email}`}
                          >
                            <Mail className="w-3 h-3 mr-1" /> Email
                          </Button>
                          
                          {user.isApproved ? (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs py-1 px-2.5 h-8 cursor-pointer font-medium"
                              onClick={() => handleUnapprove(user.id, user.email)}
                            >
                              Revoke
                            </Button>
                          ) : user.accessRequested ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs py-1 px-2.5 h-8 cursor-pointer font-medium"
                                onClick={() => handleUnapprove(user.id, user.email)}
                              >
                                Reject
                              </Button>
                              <Button 
                                size="sm" 
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1 px-2.5 h-8 cursor-pointer font-medium"
                                onClick={() => handleApprove(user.id, user.email)}
                              >
                                Approve
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" disabled className="text-xs py-1 px-2.5 h-8 opacity-35">
                              Inactive
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
};
