import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, CheckCircle, Clock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { fetchApi } from '../../utils/api';
import { config } from '../../config/env';
import toast from 'react-hot-toast';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

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
      // The backend returns { users: [...], page, limit }
      const data = await fetchApi('/admin/users');
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const [userToApprove, setUserToApprove] = useState<{id: string, email: string} | null>(null);
  const [userToUnapprove, setUserToUnapprove] = useState<{id: string, email: string} | null>(null);

  const executeApprove = async () => {
    if (!userToApprove) return;
    try {
      await fetchApi(`/admin/users/${userToApprove.id}/approve`, { method: 'PATCH' });
      setUsers(prev => prev.map(u => u.id === userToApprove.id ? { ...u, isApproved: true } : u));
      toast.success('User approved successfully.');
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
      toast.success('User access revoked successfully.');
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

  if (currentUser.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Approval Modal */}
      {userToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 scale-in-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">IMPORTANT Action Required</h3>
            <p className="text-base text-gray-600 mb-6">
              Before approving, you must add <strong className="text-gray-900">{userToApprove.email}</strong> to the Google Cloud Console Test Users list.
            </p>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8">
              <a 
                href={config.googleCloudConsoleUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium break-all flex items-center"
              >
                Open Google Cloud Console ↗
              </a>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" size="lg" onClick={() => setUserToApprove(null)}>
                Cancel
              </Button>
              <Button 
                size="lg" 
                onClick={executeApprove}
                className="shadow-md"
              >
                I've Added Them, Approve User
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Unapprove/Reject Modal */}
      {userToUnapprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 scale-in-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">IMPORTANT Action Required</h3>
            <p className="text-base text-gray-600 mb-6">
              Before rejecting/revoking, you must remove <strong className="text-gray-900">{userToUnapprove.email}</strong> from the Google Cloud Console Test Users list.
            </p>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8">
              <a 
                href={config.googleCloudConsoleUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium break-all flex items-center"
              >
                Open Google Cloud Console ↗
              </a>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" size="lg" onClick={() => setUserToUnapprove(null)}>
                Cancel
              </Button>
              <Button 
                size="lg" 
                className="bg-red-600 hover:bg-red-700 text-white shadow-md"
                onClick={executeUnapprove}
              >
                I've Removed Them, Revoke User
              </Button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-gray-900 tracking-tight">MailExtract <span className="text-xs text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 ml-1">Admin</span></span>
            </div>
            <div>
              <Link to="/dashboard">
                <Button variant="outline" size="sm" className="flex items-center">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600">Approve access requests and manage user accounts.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border border-red-100">
            {error}
          </div>
        )}

        <Card className="shadow-lg border-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 text-sm">
                  <th className="py-4 px-6 font-semibold">User</th>
                  <th className="py-4 px-6 font-semibold">Role</th>
                  <th className="py-4 px-6 font-semibold">Access Status</th>
                  <th className="py-4 px-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      Loading users...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-medium text-gray-900">{user.username}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {user.isApproved ? (
                          <span className="inline-flex items-center text-sm text-green-600 font-medium">
                            <CheckCircle className="w-4 h-4 mr-1.5" /> Approved
                          </span>
                        ) : user.accessRequested ? (
                          <span className="inline-flex items-center text-sm text-yellow-600 font-medium">
                            <Clock className="w-4 h-4 mr-1.5" /> Pending Approval
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-sm text-gray-400 font-medium">
                            Not Requested
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {user.isApproved ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                            onClick={() => handleUnapprove(user.id, user.email)}
                          >
                            Revoke Access
                          </Button>
                        ) : user.accessRequested ? (
                          <div className="flex justify-end gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                              onClick={() => handleUnapprove(user.id, user.email)}
                            >
                              Reject
                            </Button>
                            <Button 
                              size="sm" 
                              variant="primary"
                              onClick={() => handleApprove(user.id, user.email)}
                            >
                              Approve Access
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" disabled>
                            No Action
                          </Button>
                        )}
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
