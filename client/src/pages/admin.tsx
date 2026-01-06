import { useQuery } from "@tanstack/react-query";
import { type Lead } from "@shared/schema";
import { ArrowLeft, Users, FileSpreadsheet, Upload, RefreshCw, LogOut } from "lucide-react";
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
            <Button onClick={() => refetch()} variant="outline" data-testid="button-refresh-leads">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleLogout} variant="ghost" data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
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
              <div className="text-4xl font-bold text-white">{leads?.length || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <FileSpreadsheet className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-white">Rate Sheets</CardTitle>
                  <CardDescription className="text-blue-200/60">Upload lender pricing</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-blue-200/60">
                  Upload CSV or Excel files with lender rate sheets. The system will parse and apply them to new quotes.
                </p>
                <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-blue-500/50 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto mb-3 text-blue-400" />
                  <p className="text-sm text-white font-medium">Drop rate sheet here</p>
                  <p className="text-xs text-blue-200/40 mt-1">CSV, XLS, XLSX supported</p>
                </div>
                <p className="text-xs text-blue-200/40 italic">
                  Rate sheet upload feature coming soon. Currently using demo rates from PRMG, UWM, and Flagstar.
                </p>
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
