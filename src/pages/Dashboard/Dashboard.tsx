import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LogOut,
  LayoutDashboard,
  Mail,
  FileSpreadsheet,
  ShieldAlert,
  Clock,
  Settings,
  Download,
  Trash2,
  CheckCircle2,
  Send,
  Lock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { fetchApi } from '../../utils/api';
import { config } from '../../config/env';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const formatField = (val: string | null | undefined) => {
  if (!val || val === 'Unknown Sender' || val === 'Unknown Receiver' || val === 'Unknown' || val === 'N/A') return '-';
  return val;
};

const formatRequestTime = (dateStr?: string) => {
  if (!dateStr) return 'recently';
  const d = new Date(dateStr);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago (${d.toLocaleDateString('en-GB')})`;
};

const DEFAULT_BANKS: { key: string; name: string }[] = [
  { key: 'fidelity', name: 'Fidelity Bank' },
  { key: 'opay', name: 'OPay' },
  { key: 'moniepoint', name: 'Moniepoint' },
  { key: 'gtbank', name: 'GTBank' },
  { key: 'access', name: 'Access Bank' },
  { key: 'zenith', name: 'Zenith Bank' },
  { key: 'uba', name: 'UBA' },
  { key: 'firstbank', name: 'First Bank' },
  { key: 'kuda', name: 'Kuda' },
  { key: 'palmpay', name: 'PalmPay' },
  { key: 'fcmb', name: 'FCMB' },
  { key: 'sterling', name: 'Sterling Bank' },
  { key: 'wema', name: 'Wema Bank / ALAT' },
  { key: 'stanbic', name: 'Stanbic IBTC' },
  { key: 'providus', name: 'Providus Bank' },
  { key: 'lotus', name: 'Lotus Bank' },
  { key: 'polaris', name: 'Polaris Bank' },
  { key: 'keystone', name: 'Keystone Bank' },
  { key: 'union', name: 'Union Bank' },
  { key: 'taj', name: 'TAJ Bank' },
  { key: 'jaiz', name: 'Jaiz Bank' },
  { key: 'ecobank', name: 'Ecobank' },
  { key: 'unity', name: 'Unity Bank' },
  { key: 'heritage', name: 'Heritage Bank' },
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [requesting, setRequesting] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [timeline, setTimeline] = useState('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExportingSheet, setIsExportingSheet] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<{ key: string, txs: any[] } | null>(null);
  const [availableBanks, setAvailableBanks] = useState<{ key: string; name: string }[]>(DEFAULT_BANKS);
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const bankDropdownRef = useRef<HTMLDivElement>(null);

  // Close bank dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target as Node)) {
        setBankDropdownOpen(false);
      }
    };
    if (bankDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [bankDropdownOpen]);

  const handleConnectGoogleClick = () => {
    if (!user?.isApproved) {
      setShowApprovalModal(true);
      return;
    }
    const token = localStorage.getItem('accessToken');
    window.location.href = config.getGoogleAuthUrl(token);
  };

  const fetchFreshUserStatus = async () => {
    try {
      const data = await fetchApi('/auth/users/me');
      if (data?.user) {
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
      }
    } catch (err) {
      console.warn('Could not sync user status:', err);
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');

    if (!token || !userData) {
      navigate('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);

      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('gmailConnected') === 'true') {
        parsedUser.hasConnectedGmail = true;
        localStorage.setItem('user', JSON.stringify(parsedUser));
        window.history.replaceState({}, '', '/dashboard');
        toast.success('Gmail connected successfully!');
      }

      setUser(parsedUser);
      // Fetch latest approval status from server
      fetchFreshUserStatus();
    } catch (e) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    if (user?.isApproved) {
      loadHistory();
      fetchAvailableBanks();
    }
  }, [user?.isApproved]);

  const fetchAvailableBanks = async () => {
    try {
      const data = await fetchApi('/extract/banks');
      if (data.banks) setAvailableBanks(data.banks);
    } catch (err) {
      console.error('Failed to load banks:', err);
    }
  };

  const toggleBank = (key: string) => {
    setSelectedBanks(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const loadHistory = async () => {
    try {
      const data = await fetchApi('/extract/history');
      if (data.transactions) {
        setTransactions(data.transactions);
      }
    } catch (err: any) {
      console.error("Failed to load history:", err);
    }
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;

    try {
      const transactionIds = groupToDelete.txs.map(tx => tx.id);
      await fetchApi('/extract/history', {
        method: 'DELETE',
        body: JSON.stringify({ transactionIds })
      });

      toast.success('Transactions deleted successfully');
      setTransactions(prev => prev.filter(tx => !transactionIds.includes(tx.id)));
      if (expandedGroup === groupToDelete.key) {
        setExpandedGroup(null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete transactions');
    } finally {
      setGroupToDelete(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleRequestOrRemindAccess = async (isReRequest = false) => {
    setRequesting(true);
    try {
      const data = await fetchApi('/auth/users/request-access', {
        method: 'POST',
        body: JSON.stringify({ isReRequest })
      });
      const updatedUser = {
        ...user,
        accessRequested: true,
        updatedAt: data.updatedAt || new Date().toISOString()
      };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      toast.success(
        data.message || (isReRequest ? 'Admin re-notified of your request!' : 'Access request submitted to admin!'),
        { duration: 6000 }
      );
    } catch (err: any) {
      toast.error(err.message || 'Failed to request access. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  const handleRevokeAccess = async () => {
    try {
      await fetchApi('/auth/users/revoke-access', { method: 'POST' });
      const updatedUser = { ...user, accessRequested: false, isApproved: false, hasConnectedGmail: false };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setShowSettings(false);
      toast.success('Access revoked successfully.');
    } catch {
      toast.error('Failed to revoke access.');
    }
  };

  const handleRunExtraction = async () => {
    if (!user?.isApproved) {
      setShowApprovalModal(true);
      toast.error('Admin approval required to run extractions');
      return;
    }

    if (!user?.hasConnectedGmail) {
      toast.error('Please connect your Gmail account first');
      return;
    }

    if (timeline === 'custom' && (!startDate || !endDate)) {
      toast.error('Please select both start and end dates for custom range');
      return;
    }

    setIsExtracting(true);
    try {
      let url = `/extract/run?timeline=${timeline}`;
      if (timeline === 'custom') {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      if (selectedBanks.length > 0) {
        url += `&banks=${selectedBanks.join(',')}`;
      }
      const data = await fetchApi(url, { method: 'POST' });
      const bankLabel = selectedBanks.length > 0 ? selectedBanks.join(', ').toUpperCase() : 'all banks';
      toast.success(
        `Done! Extracted ${data.newTransactionsAdded ?? 0} transactions from ${bankLabel}. All 3 formats (Google Sheet link, CSV, and PDF) have been emailed to ${user?.email || 'your email'}!`,
        { duration: 8000 }
      );
      if (data.transactions && data.transactions.length > 0) {
        setTransactions(prev => [...data.transactions, ...prev]);
        setExpandedGroup(new Date(data.transactions[0].createdAt || Date.now()).toLocaleDateString());
      }
      fetchFreshUserStatus();
    } catch (err: any) {
      if (err.message && (err.message.toLowerCase().includes('reconnect') || err.message.toLowerCase().includes('expired') || err.message.toLowerCase().includes('not connected'))) {
        const updatedUser = { ...user, hasConnectedGmail: false };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      toast.error(err.message || 'Failed to run extraction.');
    } finally {
      setIsExtracting(false);
    }
  };

  const exportPDF = (txsToExport: any[] = transactions) => {
    if (txsToExport.length === 0) {
      toast.error("No transactions to export");
      return;
    }
    const doc = new jsPDF();
    doc.text("MailExtract Transaction Report", 14, 15);

    const tableColumn = ["Date", "Sender", "Sender Bank", "Receiver", "Receiver Bank", "Account", "Type", "Amount"];
    const tableRows: any[] = [];

    txsToExport.forEach(tx => {
      const txData = [
        new Date(tx.date).toLocaleDateString(),
        formatField(tx.sender),
        formatField(tx.senderBank),
        formatField(tx.receiver),
        formatField(tx.receiverBank),
        formatField(tx.accountNumber),
        tx.transactionType,
        tx.amount ? `${tx.currency || 'NGN'} ${tx.amount}` : "-"
      ];
      tableRows.push(txData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });
    doc.save("MailExtract_Report.pdf");
  };

  const exportExcel = (txsToExport: any[] = transactions, filename = 'MailExtract_Transactions') => {
    if (txsToExport.length === 0) {
      toast.error("No transactions to export");
      return;
    }
    const data = txsToExport.map(tx => ({
      Date: new Date(tx.date).toLocaleDateString('en-GB'),
      Type: tx.transactionType || 'Unknown',
      'Amount (NGN)': tx.amount ? parseFloat(tx.amount) : 0,
      Currency: tx.currency || 'NGN',
      Sender: formatField(tx.sender),
      'Sender Bank': formatField(tx.senderBank),
      Receiver: formatField(tx.receiver),
      'Receiver Bank': formatField(tx.receiverBank),
      'Account Number': formatField(tx.accountNumber),
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
    XLSX.writeFile(workbook, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel (.xlsx) spreadsheet downloaded!");
  };

  const exportCSV = (txsToExport: any[] = transactions) => {
    if (txsToExport.length === 0) {
      toast.error("No transactions to export");
      return;
    }
    const csv = Papa.unparse(txsToExport.map(tx => ({
      Date: new Date(tx.date).toLocaleDateString(),
      Sender: formatField(tx.sender),
      "Sender Bank": formatField(tx.senderBank),
      Receiver: formatField(tx.receiver),
      "Receiver Bank": formatField(tx.receiverBank),
      Account: formatField(tx.accountNumber),
      Type: tx.transactionType,
      Amount: tx.amount ? `${tx.currency || 'NGN'} ${tx.amount}` : "-"
    })));

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'MailExtract_Report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportGoogleSheet = async (txsToExport: any[] = transactions, title?: string) => {
    if (txsToExport.length === 0) {
      toast.error("No transactions to export");
      return;
    }

    const newTab = window.open('', '_blank');
    if (newTab) {
      newTab.document.write('<html><head><title>Creating Google Sheet...</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;"><div style="text-align:center;"><h2 style="color:#1e40af;">Creating your Google Sheet...</h2><p style="color:#64748b;">Please wait while MailExtract generates your spreadsheet.</p></div></body></html>');
    }

    setIsExportingSheet(true);
    const toastId = toast.loading("Generating Google Sheet in Google Drive...");
    try {
      const transactionIds = txsToExport.map(tx => tx.id || tx.messageId).filter(Boolean);
      const data = await fetchApi('/reports/google-sheet', {
        method: 'POST',
        body: JSON.stringify({ transactionIds, title }),
      });

      toast.success("Google Sheet created!", { id: toastId });
      if (data.spreadsheetUrl) {
        if (newTab) {
          newTab.location.href = data.spreadsheetUrl;
        } else {
          window.open(data.spreadsheetUrl, '_blank');
        }
      }
    } catch (err: any) {
      if (newTab) newTab.close();
      toast.error(err.message || "Failed to create Google Sheet", { id: toastId });
    } finally {
      setIsExportingSheet(false);
    }
  };

  const emailReport = async (txsToExport: any[] = transactions, title?: string) => {
    if (txsToExport.length === 0) {
      toast.error("No transactions to email");
      return;
    }
    setIsSendingEmail(true);
    const toastId = toast.loading(`Sending report to ${user?.email || 'your email'}...`);
    try {
      const transactionIds = txsToExport.map(tx => tx.id || tx.messageId).filter(Boolean);
      const data = await fetchApi('/reports/email', {
        method: 'POST',
        body: JSON.stringify({ transactionIds, title }),
      });

      toast.success(data.message || `Report emailed successfully!`, { id: toastId, duration: 5000 });
    } catch (err: any) {
      toast.error(err.message || "Failed to send email report", { id: toastId });
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!user) return null;

  const groupedTransactions = transactions.reduce((groups: any, tx: any) => {
    const exactTimeStr = tx.createdAt || tx.date;
    const dateStr = new Date(exactTimeStr).toLocaleDateString();
    const timeStr = new Date(exactTimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const key = exactTimeStr;
    if (!groups[key]) {
      groups[key] = { label: `Extraction on ${dateStr} at ${timeStr}`, txs: [] };
    }
    groups[key].txs.push(tx);
    return groups;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Account Approval & Access Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 scale-in-center">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${user.isApproved
                    ? 'bg-emerald-100 text-emerald-600'
                    : user.accessRequested
                      ? 'bg-amber-100 text-amber-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                  {user.isApproved ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : user.accessRequested ? (
                    <Clock className="w-6 h-6 animate-pulse" />
                  ) : (
                    <ShieldAlert className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Gmail Access & Approval</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mt-0.5 ${user.isApproved
                      ? 'bg-emerald-100 text-emerald-800'
                      : user.accessRequested
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                    {user.isApproved
                      ? '✓ Approved'
                      : user.accessRequested
                        ? '⏳ Pending Admin Review'
                        : 'Action Required'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowApprovalModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-gray-600 text-sm">
              {user.isApproved ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-900">
                  <p className="font-semibold mb-1">Your account is fully approved!</p>
                  <p className="text-xs text-emerald-700">
                    You can now connect your Gmail account and run financial extraction sessions.
                  </p>
                </div>
              ) : user.accessRequested ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 space-y-2">
                  <p className="font-semibold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" /> Your request is in queue
                  </p>
                  <p className="text-xs text-amber-800">
                    An administrator has been notified to review your account and add your email (<strong>{user.email}</strong>) to the Google Cloud testing list.
                  </p>
                  <p className="text-xs text-amber-700">
                    <em>Requested: {formatRequestTime(user.updatedAt || user.createdAt)}</em>
                  </p>
                  <p className="text-xs text-amber-800 pt-1 border-t border-amber-200/60">
                    💡 If your request is pending after a day, click the button below to send a fresh reminder to the administrator.
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900 space-y-1">
                  <p className="font-semibold">One-Time Approval Needed</p>
                  <p className="text-xs text-blue-800">
                    To maintain bank-grade security, our admin team must authorize your account before MailExtract can connect to Gmail.
                  </p>
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                <h4 className="font-semibold text-gray-900 text-xs uppercase tracking-wider">Privacy & Security Guarantee:</h4>
                <ul className="space-y-1.5 text-xs text-gray-600">
                  <li className="flex items-center gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span> <strong>Read-Only:</strong> We only scan financial bank alerts (OPay, GTB, Zenith, etc.).
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span> <strong>No Personal Emails:</strong> We never read personal conversations.
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="text-emerald-500 font-bold">✓</span> <strong>No Sending or Deleting:</strong> We never modify or send emails on your behalf.
                  </li>
                </ul>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => setShowApprovalModal(false)}
                >
                  Close
                </Button>

                {user.isApproved ? (
                  <Button
                    fullWidth
                    onClick={() => {
                      setShowApprovalModal(false);
                      handleConnectGoogleClick();
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    Proceed to Connect Gmail
                  </Button>
                ) : user.accessRequested ? (
                  <Button
                    fullWidth
                    onClick={() => handleRequestOrRemindAccess(true)}
                    disabled={requesting}
                    className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {requesting ? 'Sending...' : 'Remind Admin (Re-request)'}
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    onClick={() => handleRequestOrRemindAccess(false)}
                    disabled={requesting}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  >
                    {requesting ? 'Submitting...' : 'Request Access'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Modal */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 scale-in-center">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" /> Delete Extraction
              </h3>
              <button onClick={() => setGroupToDelete(null)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="border border-red-100 bg-red-50 rounded-lg p-4">
                <h4 className="font-semibold text-red-900 mb-1">Confirm Deletion</h4>
                <p className="text-sm text-red-700 mb-4">
                  Are you sure you want to delete {groupToDelete.txs.length} transactions from this extraction? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    className="bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    onClick={() => setGroupToDelete(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white shadow-sm border-0"
                    onClick={() => confirmDeleteGroup()}
                  >
                    Yes, Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 scale-in-center">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-600" /> Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="border border-red-100 bg-red-50 rounded-lg p-4">
                <h4 className="font-semibold text-red-900 mb-1">Danger Zone</h4>
                <p className="text-sm text-red-700 mb-4">
                  Revoking access will prevent MailExtract from scanning your emails and extracting future transactions.
                </p>
                <Button
                  variant="outline"
                  fullWidth
                  className="text-red-600 border-red-200 hover:bg-red-100 hover:border-red-300 bg-white"
                  onClick={() => {
                    setShowSettings(false);
                    toast((t) => (
                      <div className="flex flex-col gap-3 max-w-sm">
                        <p className="font-semibold text-gray-900 text-sm">Remove Gmail Access</p>
                        <p className="text-sm text-gray-700">
                          Are you sure you want to completely revoke access?
                        </p>
                        <div className="flex justify-end gap-2 mt-2">
                          <Button variant="outline" size="sm" onClick={() => toast.dismiss(t.id)}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => {
                              toast.dismiss(t.id);
                              handleRevokeAccess();
                            }}
                          >
                            Yes, Remove Access
                          </Button>
                        </div>
                      </div>
                    ), { duration: Infinity });
                  }}
                >
                  Remove Gmail Access
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-gray-900 tracking-tight">MailExtract</span>
            </div>
            <div className="flex items-center space-x-4 sm:space-x-6">
              {user.role === 'admin' && (
                <Link to="/admin" className="text-sm font-medium text-purple-600 hover:text-purple-800 flex items-center bg-purple-50 px-2.5 py-1 rounded-md">
                  <Settings className="w-4 h-4 mr-1" /> Admin Dashboard
                </Link>
              )}
              <span className="text-sm text-gray-600 hidden sm:inline">
                Welcome, <span className="font-semibold text-gray-900">{user.username}</span>
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center">
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">

        {/* Real-time Account Status Banner */}
        {user.isApproved ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-emerald-950 text-sm sm:text-base">Account Approved & Ready</h4>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Active
                  </span>
                </div>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Your account is verified. You can connect Gmail and run transaction extractions anytime.
                </p>
              </div>
            </div>
          </div>
        ) : user.accessRequested ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
            <div className="flex items-start sm:items-center gap-3">
              <div className="bg-amber-100 p-2.5 rounded-xl text-amber-700 mt-0.5 sm:mt-0">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-amber-950 text-sm sm:text-base">Pending Admin Approval</h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200 text-amber-900">
                    In Review
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  Requested <strong>{formatRequestTime(user.updatedAt || user.createdAt)}</strong>. Admin must review your account before Gmail can be connected.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRequestOrRemindAccess(true)}
                disabled={requesting}
                className="bg-white text-amber-900 border-amber-300 hover:bg-amber-100 text-xs flex items-center gap-1.5 shadow-sm whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                {requesting ? 'Notifying...' : 'Remind Admin (Re-request)'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowApprovalModal(true)}
                className="bg-white text-amber-800 border-amber-200 hover:bg-amber-100 text-xs whitespace-nowrap"
              >
                Details
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 sm:p-5 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
            <div className="flex items-start sm:items-center gap-3">
              <div className="bg-blue-100 p-2.5 rounded-xl text-blue-700 mt-0.5 sm:mt-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-blue-950 text-sm sm:text-base">One-Time Approval Required</h4>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-200 text-blue-900">
                    Action Needed
                  </span>
                </div>
                <p className="text-xs text-blue-800 mt-0.5">
                  Request admin approval to enable Gmail scanning for bank transaction alerts.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => handleRequestOrRemindAccess(false)}
              disabled={requesting}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs shadow-sm w-full sm:w-auto whitespace-nowrap"
            >
              {requesting ? 'Requesting...' : 'Request Access'}
            </Button>
          </div>
        )}

        {/* Dashboard 2-Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 items-stretch">

          {/* Card 1: Google Integration */}
          <Card className="hover:shadow-xl transition-shadow duration-300 relative flex flex-col h-full">
            {user.hasConnectedGmail && (
              <div className="absolute top-4 right-4">
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            )}
            <CardHeader>
              <div className="bg-blue-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
                <Mail className="h-7 w-7 text-blue-600" />
              </div>
              <CardTitle className="text-xl">1. Google Integration</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <p className="text-gray-600 mb-6 text-sm">
                Connect your Gmail account to allow MailExtract to securely scan and extract transactional emails.
              </p>
              <div className="mt-auto">
                {user.hasConnectedGmail ? (
                  <div className="flex gap-2">
                    <Button variant="outline" fullWidth disabled className="border-green-500 text-green-700 bg-green-50">
                      <CheckCircle2 className="w-4 h-4 mr-1.5 text-green-600" /> Gmail Connected
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleConnectGoogleClick} className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50 whitespace-nowrap">
                      Reconnect
                    </Button>
                  </div>
                ) : user.isApproved ? (
                  <Button variant="primary" fullWidth onClick={handleConnectGoogleClick}>
                    Connect Gmail
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleConnectGoogleClick}
                    className="bg-gray-800 hover:bg-gray-900 text-white flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4 text-amber-400" />
                    Connect Gmail {user.accessRequested ? '(Pending Approval)' : '(Approval Needed)'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Data Extraction */}
          <Card className="hover:shadow-xl transition-shadow duration-300 relative flex flex-col h-full">
            <CardHeader>
              <div className="bg-green-50 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
                <FileSpreadsheet className="h-7 w-7 text-green-600" />
              </div>
              <CardTitle className="text-xl">2. Data Extraction</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col">
              <p className="text-gray-600 mb-6 text-sm">
                Run the extraction engine to parse data from your emails.
              </p>
              <div className="flex flex-col gap-3 mt-auto">
                <div className="flex flex-col mb-2">
                  <label className="text-sm font-medium text-gray-700 mb-1">Scan Timeline</label>
                  <select
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 bg-white"
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    disabled={isExtracting}
                  >
                    <option value="this_month">This Month</option>
                    <option value="this_week">This Week</option>
                    <option value="3m">Last 3 Months</option>
                    <option value="1y">Last Year</option>
                    <option value="custom">Custom Range</option>
                  </select>

                  {timeline === 'custom' && (
                    <div className="flex gap-2 mb-3">
                      <div className="flex flex-col flex-1">
                        <label className="text-xs font-medium text-gray-500 mb-1">Start Date</label>
                        <input
                          type="date"
                          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={startDate}
                          onChange={e => setStartDate(e.target.value)}
                          disabled={isExtracting}
                        />
                      </div>
                      <div className="flex flex-col flex-1">
                        <label className="text-xs font-medium text-gray-500 mb-1">End Date</label>
                        <input
                          type="date"
                          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          value={endDate}
                          onChange={e => setEndDate(e.target.value)}
                          disabled={isExtracting}
                        />
                      </div>
                    </div>
                  )}

                  {/* Bank Filter Dropdown */}
                  {availableBanks.length > 0 && (() => {
                    const unselected = availableBanks.filter(
                      b => !selectedBanks.includes(b.key) &&
                        b.name.toLowerCase().includes(bankSearch.toLowerCase())
                    );
                    return (
                      <div ref={bankDropdownRef} className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm font-medium text-gray-700">Filter by Bank</label>
                          {selectedBanks.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedBanks([])}
                              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                              disabled={isExtracting}
                            >
                              Clear all
                            </button>
                          )}
                        </div>

                        {/* Trigger / Search input */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder={selectedBanks.length === 0 ? 'Search banks… (blank = all)' : 'Add another bank…'}
                            value={bankSearch}
                            onChange={e => { setBankSearch(e.target.value); setBankDropdownOpen(true); }}
                            onFocus={() => setBankDropdownOpen(true)}
                            disabled={isExtracting}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          />
                          <svg className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" /></svg>
                        </div>

                        {/* Dropdown list — only unselected banks matching search */}
                        {bankDropdownOpen && unselected.length > 0 && (
                          <div className="relative z-30 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                            {unselected.map(bank => (
                              <button
                                key={bank.key}
                                type="button"
                                onMouseDown={e => { e.preventDefault(); toggleBank(bank.key); setBankSearch(''); }}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                              >
                                <span className="w-4 h-4 rounded border border-gray-300 flex-shrink-0" />
                                {bank.name}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Selected banks as removable tags */}
                        {selectedBanks.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {selectedBanks.map(key => {
                              const bank = availableBanks.find(b => b.key === key);
                              if (!bank) return null;
                              return (
                                <span
                                  key={key}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200"
                                >
                                  {bank.name}
                                  <button
                                    type="button"
                                    onClick={() => toggleBank(key)}
                                    disabled={isExtracting}
                                    className="ml-0.5 text-blue-500 hover:text-blue-800 disabled:opacity-50 leading-none"
                                    aria-label={`Remove ${bank.name}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Weekly Quota Card */}
                {user.quota && !user.quota.isAdmin && (
                  <div className="mb-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex justify-between items-center mb-1.5 font-semibold text-slate-700">
                      <span>Weekly Extraction Quota</span>
                      <span className={user.quota.remaining === 0 ? 'text-rose-600 font-bold' : 'text-indigo-600 font-bold'}>
                        {user.quota.remaining} of 5 remaining
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-1">
                      <div 
                        className={`h-full transition-all duration-300 ${user.quota.remaining === 0 ? 'bg-rose-500' : 'bg-indigo-600'}`}
                        style={{ width: `${Math.min(100, (user.quota.used / 5) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">Resets every Monday at 00:00 UTC</p>
                  </div>
                )}

                <Button
                  variant="primary"
                  fullWidth
                  disabled={isExtracting || (user.quota && !user.quota.isAdmin && user.quota.remaining === 0)}
                  onClick={handleRunExtraction}
                >
                  {isExtracting ? (
                    'Extracting...'
                  ) : user.quota && !user.quota.isAdmin && user.quota.remaining === 0 ? (
                    'Weekly Limit Reached (0/5)'
                  ) : (
                    'Run New Extraction'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table Section */}
        {Object.keys(groupedTransactions).length > 0 && (
          <div className="mt-8 space-y-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Past Extractions</h3>

            {Object.keys(groupedTransactions).map((groupKey) => {
              const groupData = groupedTransactions[groupKey];
              const groupTxs = groupData.txs;
              const groupLabel = groupData.label;
              const isExpanded = expandedGroup === groupKey;

              return (
                <Card key={groupKey} className="shadow-sm border-t-2 border-t-green-500 overflow-hidden">
                  <div
                    className="flex flex-row items-center justify-between p-4 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedGroup(isExpanded ? null : groupKey)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-lg">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{groupLabel}</h4>
                        <p className="text-xs text-gray-500">{groupTxs.length} transaction{groupTxs.length !== 1 ? 's' : ''} found</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {isExpanded && (
                        <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportExcel(groupTxs, groupLabel.replace(/[^a-zA-Z0-9]/g, '_'))}
                            className="flex items-center gap-1 h-8 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          >
                            <Download className="w-3 h-3 text-emerald-600" /> Excel (.xlsx)
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => exportCSV(groupTxs)} className="flex items-center gap-1 h-8 text-xs">
                            <Download className="w-3 h-3" /> CSV
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => exportPDF(groupTxs)} className="flex items-center gap-1 h-8 text-xs">
                            <Download className="w-3 h-3" /> PDF
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportGoogleSheet(groupTxs, groupLabel)}
                            disabled={isExportingSheet}
                            className="flex items-center gap-1 h-8 text-xs text-green-700 border-green-300 hover:bg-green-50"
                          >
                            <FileSpreadsheet className="w-3 h-3 text-green-600" /> Google Sheet (Drive)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => emailReport(groupTxs, groupLabel)}
                            disabled={isSendingEmail}
                            className="flex items-center gap-1 h-8 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
                          >
                            <Mail className="w-3 h-3 text-blue-600" /> Email Report
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setGroupToDelete({ key: groupKey, txs: groupTxs })} className="flex items-center gap-1 h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300">
                            <Trash2 className="w-3 h-3" /> Delete
                          </Button>
                        </div>
                      )}
                      <span className="text-gray-400">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                          <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b">
                            <tr>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">Sender</th>
                              <th className="px-4 py-3">Sender Bank</th>
                              <th className="px-4 py-3">Receiver</th>
                              <th className="px-4 py-3">Receiver Bank</th>
                              <th className="px-4 py-3">Account</th>
                              <th className="px-4 py-3">Type</th>
                              <th className="px-4 py-3">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupTxs.map((tx: any, idx: number) => (
                              <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {new Date(tx.date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {formatField(tx.sender)}
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  {formatField(tx.senderBank)}
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {formatField(tx.receiver)}
                                </td>
                                <td className="px-4 py-3 text-gray-600">
                                  {formatField(tx.receiverBank)}
                                </td>
                                <td className="px-4 py-3">
                                  {formatField(tx.accountNumber)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tx.transactionType === 'Credit' ? 'bg-green-100 text-green-800' : tx.transactionType === 'Debit' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {tx.transactionType}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900">
                                  {tx.amount ? `${tx.currency || 'NGN'} ${tx.amount}` : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
