import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  CheckCircle2, 
  Send, 
  Search, 
  Sparkles, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  ChevronDown 
} from 'lucide-react';
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

const formatCurrency = (amountStr: string | number | null | undefined, currency = 'NGN') => {
  if (!amountStr) return '₦0.00';
  const num = typeof amountStr === 'number' ? amountStr : parseFloat(amountStr.toString().replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return `${currency} ${amountStr}`;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency === 'NGN' ? 'NGN' : 'USD',
    minimumFractionDigits: 2
  }).format(num);
};

const DEFAULT_BANKS: { key: string; name: string }[] = [
  { key: 'gtbank', name: 'GTBank' },
  { key: 'opay', name: 'OPay' },
  { key: 'moniepoint', name: 'Moniepoint' },
  { key: 'access', name: 'Access Bank' },
  { key: 'zenith', name: 'Zenith Bank' },
  { key: 'uba', name: 'UBA' },
  { key: 'kuda', name: 'Kuda' },
  { key: 'palmpay', name: 'PalmPay' },
  { key: 'firstbank', name: 'First Bank' },
  { key: 'fidelity', name: 'Fidelity' },
  { key: 'stanbic', name: 'Stanbic IBTC' },
  { key: 'wema', name: 'Wema / ALAT' },
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [requesting, setRequesting] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Extraction options
  const [timeline, setTimeline] = useState('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [availableBanks, setAvailableBanks] = useState<{ key: string; name: string }[]>(DEFAULT_BANKS);
  
  // Transactions & UI State
  const [transactions, setTransactions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Credit' | 'Debit'>('ALL');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isExportingSheet, setIsExportingSheet] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<{ key: string; txs: any[] } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

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
      fetchFreshUserStatus();
    } catch {
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
      if (data.banks && Array.isArray(data.banks)) setAvailableBanks(data.banks);
    } catch {
      // Keep default banks
    }
  };

  const loadHistory = async () => {
    try {
      const data = await fetchApi('/extract/history');
      if (data.transactions) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const toggleBank = (key: string) => {
    setSelectedBanks(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
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
        { duration: 5000 }
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
      toast.error('Please select both start and end dates');
      return;
    }
    
    setIsExtracting(true);
    const toastId = toast.loading('Scanning Gmail & extracting transactions with AI...');
    try {
      let url = `/extract/run?timeline=${timeline}`;
      if (timeline === 'custom') {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      if (selectedBanks.length > 0) {
        url += `&banks=${selectedBanks.join(',')}`;
      }
      const data = await fetchApi(url, { method: 'POST' });
      toast.success(
        `Extracted ${data.newTransactionsAdded ?? 0} transactions! Report generated and synced.`,
        { id: toastId, duration: 6000 }
      );
      if (data.transactions && data.transactions.length > 0) {
        setTransactions(prev => [...data.transactions, ...prev]);
      }
    } catch (err: any) {
      if (err.message && (err.message.toLowerCase().includes('reconnect') || err.message.toLowerCase().includes('expired') || err.message.toLowerCase().includes('not connected'))) {
        const updatedUser = { ...user, hasConnectedGmail: false };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      toast.error(err.message || 'Failed to run extraction.', { id: toastId });
    } finally {
      setIsExtracting(false);
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
      toast.success('Transactions removed');
      setTransactions(prev => prev.filter(tx => !transactionIds.includes(tx.id)));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete transactions');
    } finally {
      setGroupToDelete(null);
    }
  };

  // Filtered Transactions & Summary Metrics
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesType = typeFilter === 'ALL' || tx.transactionType?.toLowerCase() === typeFilter.toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchesType;
      
      const searchTarget = `
        ${tx.sender || ''} 
        ${tx.receiver || ''} 
        ${tx.senderBank || ''} 
        ${tx.receiverBank || ''} 
        ${tx.amount || ''} 
        ${tx.accountNumber || ''} 
        ${tx.transactionType || ''}
      `.toLowerCase();

      return matchesType && searchTarget.includes(query);
    });
  }, [transactions, typeFilter, searchQuery]);

  const metrics = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;

    filteredTransactions.forEach(tx => {
      const amount = parseFloat(tx.amount || '0');
      if (!isNaN(amount)) {
        if (tx.transactionType?.toLowerCase() === 'credit') {
          totalInflow += amount;
        } else if (tx.transactionType?.toLowerCase() === 'debit') {
          totalOutflow += amount;
        }
      }
    });

    return {
      totalInflow,
      totalOutflow,
      netFlow: totalInflow - totalOutflow,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  // Export handlers
  const exportExcel = (txsToExport = filteredTransactions) => {
    if (txsToExport.length === 0) return toast.error("No transactions to export");
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
    XLSX.writeFile(workbook, `MailExtract_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel (.xlsx) downloaded!");
    setShowExportMenu(false);
  };

  const exportPDF = (txsToExport = filteredTransactions) => {
    if (txsToExport.length === 0) return toast.error("No transactions to export");
    const doc = new jsPDF();
    doc.text("MailExtract Financial Report", 14, 15);
    const tableColumn = ["Date", "Type", "Amount", "Sender", "Sender Bank", "Receiver", "Receiver Bank"];
    const tableRows = txsToExport.map(tx => [
      new Date(tx.date).toLocaleDateString(),
      tx.transactionType || '-',
      tx.amount ? `${tx.currency || 'NGN'} ${tx.amount}` : "-",
      formatField(tx.sender),
      formatField(tx.senderBank),
      formatField(tx.receiver),
      formatField(tx.receiverBank),
    ]);
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 22 });
    doc.save("MailExtract_Report.pdf");
    toast.success("PDF report downloaded!");
    setShowExportMenu(false);
  };

  const exportCSV = (txsToExport = filteredTransactions) => {
    if (txsToExport.length === 0) return toast.error("No transactions to export");
    const csv = Papa.unparse(txsToExport.map(tx => ({
      Date: new Date(tx.date).toLocaleDateString(),
      Type: tx.transactionType,
      Amount: tx.amount ? `${tx.currency || 'NGN'} ${tx.amount}` : "-",
      Sender: formatField(tx.sender),
      "Sender Bank": formatField(tx.senderBank),
      Receiver: formatField(tx.receiver),
      "Receiver Bank": formatField(tx.receiverBank),
      Account: formatField(tx.accountNumber),
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'MailExtract_Report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV file downloaded!");
    setShowExportMenu(false);
  };

  const exportGoogleSheet = async (txsToExport = filteredTransactions) => {
    if (txsToExport.length === 0) return toast.error("No transactions to export");
    setIsExportingSheet(true);
    setShowExportMenu(false);
    const toastId = toast.loading("Creating Google Sheet in Google Drive...");
    try {
      const transactionIds = txsToExport.map(tx => tx.id || tx.messageId).filter(Boolean);
      const data = await fetchApi('/reports/google-sheet', {
        method: 'POST',
        body: JSON.stringify({ transactionIds, title: `MailExtract Report - ${new Date().toLocaleDateString()}` }),
      });
      toast.success("Google Sheet created!", { id: toastId });
      if (data.spreadsheetUrl) {
        window.open(data.spreadsheetUrl, '_blank');
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create Google Sheet", { id: toastId });
    } finally {
      setIsExportingSheet(false);
    }
  };

  const emailReport = async (txsToExport = filteredTransactions) => {
    if (txsToExport.length === 0) return toast.error("No transactions to email");
    setIsSendingEmail(true);
    setShowExportMenu(false);
    const toastId = toast.loading(`Sending report to ${user?.email || 'your email'}...`);
    try {
      const transactionIds = txsToExport.map(tx => tx.id || tx.messageId).filter(Boolean);
      const data = await fetchApi('/reports/email', {
        method: 'POST',
        body: JSON.stringify({ transactionIds, title: `MailExtract Summary - ${new Date().toLocaleDateString()}` }),
      });
      toast.success(data.message || 'Report emailed successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to send email report", { id: toastId });
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 font-sans pb-16">
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-600" /> Account Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-4">
              <h4 className="font-semibold text-rose-900 text-sm mb-1">Disconnect Gmail Integration</h4>
              <p className="text-xs text-rose-700 mb-3">
                Revoking access will disconnect your Gmail account and disable future automated bank extractions.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                fullWidth
                onClick={handleRevokeAccess}
                className="bg-white text-rose-600 border-rose-200 hover:bg-rose-100"
              >
                Disconnect Gmail
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setShowSettings(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Modal */}
      {groupToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Extraction</h3>
            <p className="text-sm text-slate-600 mb-5">
              Are you sure you want to delete these {groupToDelete.txs.length} transactions? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setGroupToDelete(null)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={confirmDeleteGroup}>Yes, Delete</Button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900">Access Approval Required</h3>
              </div>
              <button onClick={() => setShowApprovalModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              To connect your Gmail account, an administrator must authorize your email (<strong>{user.email}</strong>) in the Google Cloud Console.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800">Bank-grade Security Guarantee:</p>
              <p>✓ Read-only scanning restricted strictly to financial bank alerts.</p>
              <p>✓ Zero storage of personal conversation content.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowApprovalModal(false)}>Cancel</Button>
              <Button 
                size="sm"
                onClick={() => {
                  handleRequestOrRemindAccess(user.accessRequested);
                  setShowApprovalModal(false);
                }}
                disabled={requesting}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {user.accessRequested ? 'Send Reminder' : 'Request Access'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                MailExtract
              </span>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                PRO
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user.role === 'admin' && (
              <Link 
                to="/admin" 
                className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-100 transition-colors flex items-center gap-1"
              >
                <Settings className="w-3.5 h-3.5" /> Admin Panel
              </Link>
            )}

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <span className="text-sm font-medium text-slate-700 hidden sm:inline">
                {user.username}
              </span>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">

        {/* STEP 1: Quick Action / Status Ribbon */}
        {!user.hasConnectedGmail && (
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 rounded-2xl p-5 sm:p-6 text-white shadow-lg shadow-blue-500/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md text-white">
                  Step 1
                </span>
                <h3 className="text-lg font-bold">Connect Your Gmail to Start Extracting</h3>
              </div>
              <p className="text-xs sm:text-sm text-blue-100 max-w-xl">
                Allow MailExtract to scan transaction notifications from Nigerian banks and generate instant financial spreadsheets.
              </p>
            </div>

            {user.isApproved ? (
              <Button
                onClick={handleConnectGoogleClick}
                className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-5 py-2.5 rounded-xl shadow-md whitespace-nowrap text-sm border-0"
              >
                <Mail className="w-4 h-4 mr-2" /> Connect Gmail Now
              </Button>
            ) : user.accessRequested ? (
              <Button
                onClick={() => handleRequestOrRemindAccess(true)}
                disabled={requesting}
                className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold px-5 py-2.5 rounded-xl shadow-md whitespace-nowrap text-sm border-0"
              >
                <Clock className="w-4 h-4 mr-2 animate-pulse" /> Pending Approval (Remind Admin)
              </Button>
            ) : (
              <Button
                onClick={() => handleRequestOrRemindAccess(false)}
                disabled={requesting}
                className="bg-white text-blue-700 hover:bg-blue-50 font-semibold px-5 py-2.5 rounded-xl shadow-md whitespace-nowrap text-sm border-0"
              >
                <Send className="w-4 h-4 mr-2" /> Request Approval
              </Button>
            )}
          </div>
        )}

        {/* STEP 2: Unified Command & Extraction Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">Extraction Controls</h2>
                <p className="text-xs text-slate-500">Choose scan timeframe and bank filters, then extract with AI</p>
              </div>
            </div>

            {/* Connection Status Badge */}
            <div className="flex items-center gap-2">
              {user.hasConnectedGmail ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Gmail Linked
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Clock className="w-3.5 h-3.5" /> Gmail Disconnected
                </div>
              )}
            </div>
          </div>

          {/* Timeline Pills */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Select Timeframe</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'this_month', label: 'This Month' },
                { id: 'this_week', label: 'This Week' },
                { id: '3m', label: 'Last 3 Months' },
                { id: '1y', label: 'Last Year' },
                { id: 'custom', label: 'Custom Dates' },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTimeline(item.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    timeline === item.id 
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {timeline === 'custom' && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
                  <span className="text-slate-500">From:</span>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-transparent focus:outline-none text-slate-800"
                  />
                </div>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs">
                  <span className="text-slate-500">To:</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => setEndDate(e.target.value)}
                    className="bg-transparent focus:outline-none text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Bank Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Filter By Bank {selectedBanks.length > 0 && `(${selectedBanks.length} Selected)`}
              </label>
              {selectedBanks.length > 0 && (
                <button 
                  onClick={() => setSelectedBanks([])}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Clear bank filters (Select All)
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedBanks([])}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedBanks.length === 0 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Banks
              </button>
              {availableBanks.map(bank => {
                const isSelected = selectedBanks.includes(bank.key);
                return (
                  <button
                    key={bank.key}
                    type="button"
                    onClick={() => toggleBank(bank.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      isSelected 
                        ? 'bg-blue-100 text-blue-800 border border-blue-300 font-semibold' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                    }`}
                  >
                    {bank.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Run Extraction Button */}
          <div className="pt-2">
            <Button
              onClick={handleRunExtraction}
              disabled={isExtracting}
              fullWidth
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold h-12 rounded-xl shadow-md shadow-blue-500/20 text-sm flex items-center justify-center gap-2 border-0 cursor-pointer"
            >
              {isExtracting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Extracting Transactions with AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Run Instant Extraction
                </>
              )}
            </Button>
          </div>
        </div>

        {/* STEP 3: Financial Analytics Cards */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-emerald-600 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Inflow</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-900">
                {formatCurrency(metrics.totalInflow)}
              </div>
              <span className="text-[11px] text-emerald-600 font-medium">Credits from bank alerts</span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-rose-600 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Outflow</span>
                <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center">
                  <ArrowUpRight className="w-4 h-4 text-rose-600" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-900">
                {formatCurrency(metrics.totalOutflow)}
              </div>
              <span className="text-[11px] text-rose-600 font-medium">Debits & payments</span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-blue-600 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Cash Flow</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-blue-600" />
                </div>
              </div>
              <div className={`text-lg sm:text-2xl font-black ${metrics.netFlow >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                {formatCurrency(metrics.netFlow)}
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Inflow vs Outflow</span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex items-center justify-between text-indigo-600 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Transactions</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-900">
                {metrics.count}
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Matching records</span>
            </div>
          </div>
        )}

        {/* STEP 4: Interactive Transactions Table & Unified Export Hub */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          
          {/* Header Controls */}
          <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Transaction History</h3>
              <p className="text-xs text-slate-500">
                Showing {filteredTransactions.length} of {transactions.length} total extracted transactions
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              
              {/* Search Bar */}
              <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Search sender, bank, amount..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                {(['ALL', 'Credit', 'Debit'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      typeFilter === t 
                        ? 'bg-white text-slate-900 shadow-xs' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {t === 'ALL' ? 'All' : t === 'Credit' ? 'Inflows (+)' : 'Outflows (-)'}
                  </button>
                ))}
              </div>

              {/* Unified Export Menu Dropdown */}
              <div className="relative" ref={exportMenuRef}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={filteredTransactions.length === 0}
                  className="h-9 px-3.5 bg-slate-900 text-white hover:bg-slate-800 border-0 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export & Share
                  <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </Button>

                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-1.5 space-y-1 animate-in fade-in">
                    <button
                      onClick={() => exportExcel()}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" /> Download Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => exportPDF()}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-rose-600" /> Download PDF Report
                    </button>
                    <button
                      onClick={() => exportCSV()}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" /> Download CSV
                    </button>
                    <div className="border-t border-slate-100 my-1"></div>
                    <button
                      onClick={() => exportGoogleSheet()}
                      disabled={isExportingSheet}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2 transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Create Google Sheet (Drive)
                    </button>
                    <button
                      onClick={() => emailReport()}
                      disabled={isSendingEmail}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-xl flex items-center gap-2 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-blue-600" /> Email Report to Me
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Table Body */}
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-sm">No transactions found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {transactions.length === 0 
                    ? 'Click "Run Instant Extraction" above to scan your connected Gmail account.'
                    : 'Try changing your search query or filter tags to see matching records.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200/80">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Sender & Bank</th>
                    <th className="py-3 px-4">Receiver & Bank</th>
                    <th className="py-3 px-4">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((tx, idx) => {
                    const isCredit = tx.transactionType?.toLowerCase() === 'credit';
                    const isDebit = tx.transactionType?.toLowerCase() === 'debit';
                    
                    return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                          {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isCredit 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : isDebit 
                              ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {isCredit ? '+' : isDebit ? '-' : ''} {tx.transactionType || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-black text-slate-900 whitespace-nowrap">
                          <span className={isCredit ? 'text-emerald-700' : isDebit ? 'text-rose-700' : 'text-slate-900'}>
                            {formatCurrency(tx.amount, tx.currency)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{formatField(tx.sender)}</div>
                          <div className="text-[11px] text-slate-500">{formatField(tx.senderBank)}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{formatField(tx.receiver)}</div>
                          <div className="text-[11px] text-slate-500">{formatField(tx.receiverBank)}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">
                          {formatField(tx.accountNumber)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>
    </div>
  );
};
