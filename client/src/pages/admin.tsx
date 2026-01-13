import { useQuery } from "@tanstack/react-query";
import { type Lead } from "@shared/schema";
import { ArrowLeft, Users, FileSpreadsheet, Upload, RefreshCw, LogOut, TrendingUp, TrendingDown, Calendar, Sheet, Loader2, Trash2, ToggleLeft, ToggleRight, CheckCircle, AlertCircle, Cloud, CloudOff } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

// Map credit score labels to ranges
const creditScoreRanges: Record<string, string> = {
  excellent: "740-850",
  good: "700-739",
  fair: "650-699",
  poor: "300-649",
};

export default function Admin() {
  const [, setLocation] = useLocation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    fetch("/api/admin/session")
      .then(res => res.json())
      .then(data => {
        if (!data.isAdmin) {
          setLocation("/admin/login");
        } else {
          setIsCheckingAuth(false);
        }
      })
      .catch(() => setLocation("/admin/login"));
  }, [setLocation]);

  const { data: leads, isLoading, refetch } = useQuery<Lead[]>({
    queryKey: ["/api/leads"],
    enabled: !isCheckingAuth,
  });

  const { data: leadStats, refetch: refetchStats } = useQuery<{
    totalLeads: number;
    thisWeek: number;
    lastWeek: number;
    percentChange: number;
  }>({
    queryKey: ["/api/admin/lead-stats"],
    enabled: !isCheckingAuth,
  });

  interface RateSheetInfo {
    id: number;
    lenderName: string;
    fileName: string;
    isActive: string;
    uploadedAt: string;
  }

  const { data: rateSheets, refetch: refetchRateSheets } = useQuery<RateSheetInfo[]>({
    queryKey: ["/api/admin/rate-sheets"],
    enabled: !isCheckingAuth,
  });

  interface RateSheetStatus {
    id: number;
    lenderName: string;
    fileName: string;
    parseSuccess: boolean;
    rateCount: number;
    parseError?: string;
  }

  const { data: rateSheetStatus, refetch: refetchStatus } = useQuery<RateSheetStatus[]>({
    queryKey: ["/api/admin/rate-sheet-status"],
    enabled: !isCheckingAuth && (rateSheets?.length ?? 0) > 0,
  });

  interface LlamaCloudStatus {
    connected: boolean;
    message: string;
    indexName?: string;
  }

  const { data: llamaCloudStatus } = useQuery<LlamaCloudStatus>({
    queryKey: ["/api/admin/llamacloud-status"],
    enabled: !isCheckingAuth,
  });

  const handleRefresh = () => {
    refetch();
    refetchStats();
    refetchRateSheets();
    refetchStatus();
  };

  const [isUploading, setIsUploading] = useState(false);
  const [uploadLenderName, setUploadLenderName] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!uploadLenderName.trim()) {
      alert("Please enter a lender name first");
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const fileData = event.target?.result as string;
        const response = await apiRequest("POST", "/api/admin/rate-sheets", {
          lenderName: uploadLenderName.trim(),
          fileName: file.name,
          fileData: fileData
        });
        
        if (response.ok) {
          setUploadLenderName("");
          refetchRateSheets();
        } else {
          const error = await response.json();
          alert(error.message || "Upload failed");
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload rate sheet");
      setIsUploading(false);
    }
    e.target.value = "";
  };

  const handleDeleteRateSheet = async (id: number) => {
    if (!confirm("Are you sure you want to delete this rate sheet?")) return;
    try {
      await apiRequest("DELETE", `/api/admin/rate-sheets/${id}`, {});
      refetchRateSheets();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleToggleRateSheet = async (id: number, currentActive: string) => {
    try {
      await apiRequest("PATCH", `/api/admin/rate-sheets/${id}`, {
        isActive: currentActive === "yes" ? "no" : "yes"
      });
      refetchRateSheets();
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSyncToSheets = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const response = await apiRequest("POST", "/api/admin/sync-sheets", {});
      const result = await response.json();
      if (result.success) {
        setSyncMessage({ type: 'success', text: result.message });
      } else {
        setSyncMessage({ type: 'error', text: result.message });
      }
    } catch (err: any) {
      setSyncMessage({ type: 'error', text: err.message || 'Sync failed' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/admin/logout", {});
      setLocation("/admin/login");
    } catch (err) {
      console.error("Logout failed");
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#050818] flex items-center justify-center">
        <div className="text-blue-200/60">Checking authentication...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050818] text-white">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back-home">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-blue-200/60">Manage leads and rate sheets</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleSyncToSheets} 
              variant="outline" 
              disabled={isSyncing}
              data-testid="button-sync-sheets"
            >
              {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sheet className="w-4 h-4 mr-2" />}
              Sync to Sheets
            </Button>
            <Button onClick={handleRefresh} variant="outline" data-testid="button-refresh-leads">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleLogout} variant="ghost" data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {syncMessage && (
          <div className={`p-4 rounded-lg ${syncMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`} data-testid="text-sync-message">
            {syncMessage.text}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-white">Total Leads</CardTitle>
                  <CardDescription className="text-blue-200/60">All captured submissions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white" data-testid="text-total-leads">{leadStats?.totalLeads ?? leads?.length ?? 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Calendar className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-white">New This Week</CardTitle>
                  <CardDescription className="text-blue-200/60">Leads since Sunday</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3">
                <div className="text-4xl font-bold text-white" data-testid="text-this-week-leads">{leadStats?.thisWeek ?? 0}</div>
                {leadStats && (
                  <div className={`flex items-center gap-1 text-sm pb-1 ${leadStats.percentChange >= 0 ? 'text-green-400' : 'text-red-400'}`} data-testid="text-percent-change">
                    {leadStats.percentChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>{leadStats.percentChange >= 0 ? '+' : ''}{leadStats.percentChange}%</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-blue-200/40 mt-2">vs last week ({leadStats?.lastWeek ?? 0} leads)</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <FileSpreadsheet className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-white">Rate Sheets ({rateSheets?.length ?? 0}/5)</CardTitle>
                  <CardDescription className="text-blue-200/60">Upload lender pricing</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rateSheets && rateSheets.length > 0 && (
                  <div className="space-y-2">
                    {rateSheets.map((sheet) => {
                      const status = rateSheetStatus?.find(s => s.id === sheet.id);
                      return (
                        <div 
                          key={sheet.id} 
                          className={`flex items-center justify-between gap-2 p-3 rounded-lg ${sheet.isActive === 'yes' ? 'bg-green-500/10 border border-green-500/30' : 'bg-white/5 border border-white/10 opacity-50'}`}
                          data-testid={`rate-sheet-${sheet.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-white font-medium truncate">{sheet.lenderName}</p>
                              {status && (
                                status.parseSuccess ? (
                                  <span className="flex items-center gap-1 text-[10px] text-green-400">
                                    <CheckCircle className="w-3 h-3" />
                                    {status.rateCount} rates
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[10px] text-red-400" title={status.parseError}>
                                    <AlertCircle className="w-3 h-3" />
                                    Parse failed
                                  </span>
                                )
                              )}
                            </div>
                            <p className="text-xs text-blue-200/40 truncate">{sheet.fileName}</p>
                            {status && !status.parseSuccess && status.parseError && (
                              <p className="text-[10px] text-red-400/70 truncate mt-1">{status.parseError}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={() => handleToggleRateSheet(sheet.id, sheet.isActive)}
                              data-testid={`button-toggle-sheet-${sheet.id}`}
                            >
                              {sheet.isActive === 'yes' ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4 text-blue-200/40" />}
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => handleDeleteRateSheet(sheet.id)}
                              data-testid={`button-delete-sheet-${sheet.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(!rateSheets || rateSheets.length < 5) && (
                  <>
                    <input
                      type="text"
                      placeholder="Lender name (e.g., UWM, PRMG)"
                      value={uploadLenderName}
                      onChange={(e) => setUploadLenderName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-blue-200/40 text-sm"
                      data-testid="input-lender-name"
                    />
                    <label className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:border-blue-500/50 transition-colors cursor-pointer block">
                      <input 
                        type="file" 
                        accept=".csv,.xls,.xlsx,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isUploading}
                        data-testid="input-rate-sheet-file"
                      />
                      {isUploading ? (
                        <Loader2 className="w-6 h-6 mx-auto mb-2 text-blue-400 animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                      )}
                      <p className="text-sm text-white font-medium">Drop rate sheet here</p>
                      <p className="text-xs text-blue-200/40 mt-1">Excel (.xlsx) recommended, PDF also supported</p>
                    </label>
                  </>
                )}

                <p className="text-xs text-blue-200/40 italic">
                  Upload up to 5 wholesale lender rate sheets. Successfully parsed sheets will be used for live rate quotes. Sheets with parse errors will use fallback mock rates.
                </p>

                <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${llamaCloudStatus?.connected ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
                  {llamaCloudStatus?.connected ? (
                    <>
                      <Cloud className="w-4 h-4 text-green-400" />
                      <div>
                        <p className="text-sm text-green-400 font-medium">LlamaCloud Connected</p>
                        <p className="text-xs text-green-400/60">{llamaCloudStatus.indexName || 'Index ready'}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <CloudOff className="w-4 h-4 text-yellow-400" />
                      <div>
                        <p className="text-sm text-yellow-400 font-medium">LlamaCloud Offline</p>
                        <p className="text-xs text-yellow-400/60">{llamaCloudStatus?.message || 'Using local parsing fallback'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-white">Lead Submissions</CardTitle>
                  <CardDescription className="text-blue-200/60">All mortgage quote requests</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-blue-200/60">Loading leads...</div>
            ) : !leads || leads.length === 0 ? (
              <div className="text-center py-12 text-blue-200/60">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p>No leads yet. Submissions will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-white/5">
                      <TableHead className="text-blue-200/60">Name</TableHead>
                      <TableHead className="text-blue-200/60">Email</TableHead>
                      <TableHead className="text-blue-200/60">Phone</TableHead>
                      <TableHead className="text-blue-200/60">Purpose</TableHead>
                      <TableHead className="text-blue-200/60">Loan Amount</TableHead>
                      <TableHead className="text-blue-200/60">Property Value</TableHead>
                      <TableHead className="text-blue-200/60">Property Type</TableHead>
                      <TableHead className="text-blue-200/60">Loan Type</TableHead>
                      <TableHead className="text-blue-200/60">Loan Term</TableHead>
                      <TableHead className="text-blue-200/60">Credit Score</TableHead>
                      <TableHead className="text-blue-200/60">Income</TableHead>
                      <TableHead className="text-blue-200/60">Zip Code</TableHead>
                      <TableHead className="text-blue-200/60">First Time Buyer</TableHead>
                      <TableHead className="text-blue-200/60">Quoted Rates</TableHead>
                      <TableHead className="text-blue-200/60">Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => {
                      let quotedRates: Array<{optionNumber: number; actualLender: string; rate: number; apr: number; lenderFee?: number; lenderCredit?: number; note?: string}> = [];
                      try {
                        if (lead.quotedRates) {
                          quotedRates = JSON.parse(lead.quotedRates);
                        }
                      } catch {}
                      
                      return (
                        <TableRow key={lead.id} className="border-white/10 hover:bg-white/5">
                          <TableCell className="text-white font-medium whitespace-nowrap">
                            {lead.firstName} {lead.lastName}
                          </TableCell>
                          <TableCell className="text-blue-200/80">{lead.email}</TableCell>
                          <TableCell className="text-blue-200/80 whitespace-nowrap">{lead.phone}</TableCell>
                          <TableCell className="capitalize text-blue-200/80">{lead.loanPurpose}</TableCell>
                          <TableCell className="text-white whitespace-nowrap">${lead.loanAmount.toLocaleString()}</TableCell>
                          <TableCell className="text-white whitespace-nowrap">${lead.propertyValue.toLocaleString()}</TableCell>
                          <TableCell className="text-blue-200/80 capitalize whitespace-nowrap">{lead.propertyType.replace(/_/g, ' ')}</TableCell>
                          <TableCell className="text-blue-200/80 capitalize">{lead.loanType}</TableCell>
                          <TableCell className="text-blue-200/80">{lead.loanTerm}</TableCell>
                          <TableCell className="text-blue-200/80 whitespace-nowrap">{creditScoreRanges[lead.creditScore] || lead.creditScore}</TableCell>
                          <TableCell className="text-white whitespace-nowrap">${lead.annualIncome.toLocaleString()}</TableCell>
                          <TableCell className="text-blue-200/80">{lead.zipCode}</TableCell>
                          <TableCell className="text-blue-200/80 capitalize">{lead.isFirstTimeBuyer === 'yes' ? 'Yes' : 'No'}</TableCell>
                          <TableCell className="text-blue-200/80">
                            {quotedRates.length > 0 ? (
                              <div className="space-y-1 text-xs max-w-xs">
                                {quotedRates.slice(0, 3).map((r, i) => (
                                  <div key={i} className="flex items-center gap-2 whitespace-nowrap">
                                    <span className="text-white font-medium">{r.actualLender}:</span>
                                    <span className="text-[#5cffb5]">{r.rate.toFixed(3)}%</span>
                                    {r.lenderFee && <span className="text-red-400 text-[10px]">+${r.lenderFee.toLocaleString()}</span>}
                                    {r.lenderCredit && <span className="text-green-400 text-[10px]">-${r.lenderCredit.toLocaleString()}</span>}
                                  </div>
                                ))}
                                {quotedRates.length > 3 && (
                                  <span className="text-blue-200/40 text-[10px]">+{quotedRates.length - 3} more</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-blue-200/40 text-[10px]">No rates</span>
                            )}
                          </TableCell>
                          <TableCell className="text-blue-200/60 text-sm whitespace-nowrap">
                            {lead.createdAt ? (() => {
                              try {
                                return format(new Date(lead.createdAt), "MMM d, h:mm a");
                              } catch {
                                return "N/A";
                              }
                            })() : "N/A"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
