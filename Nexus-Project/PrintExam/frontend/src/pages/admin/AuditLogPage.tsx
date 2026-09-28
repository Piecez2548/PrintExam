import React, { useState, useEffect } from 'react';
import { auditApi } from '../../api/audit';
import { AuditLogItem, UserRole } from '../../types';
import { RoleBadge } from '../../components/common/RoleBadge';
import { Modal } from '../../components/common/Modal';
import {
  History,
  Search,
  Filter,
  Shield,
  FileCode2,
  Calendar,
  Clock,
  User,
  Activity,
  Code,
} from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters (REQ-0013)
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // JSON Payload Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const res = await auditApi.getAuditLogs({
        search: searchQuery || undefined,
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        limit: 150,
      });
      setLogs(res.logs);
      setTotalLogs(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [searchQuery, actionFilter, entityFilter, startDate, endDate]);

  const parseJson = (raw?: string) => {
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
            <History className="w-6 h-6 text-brand-600" />
            <span>ประวัติการดำเนินงานทั้งหมด (Audit Logs)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            บันทึกประวัติทุกขั้นตอน: ส่ง, แก้ไข, เปลี่ยนสถานะ, พิมพ์, บรรจุ, ส่งมอบ พร้อมผู้ดำเนินการและวัน-เวลา
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ค้นหาชื่อผู้ดำเนินการ, Action, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto text-xs">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-medium"
          >
            <option value="">ทุก Entity Type</option>
            <option value="EXAM">ข้อสอบ (EXAM)</option>
            <option value="USER">ผู้ใช้งาน (USER)</option>
            <option value="COURSE">รายวิชา (COURSE)</option>
            <option value="SCHEDULE">กำหนดการสอบ (SCHEDULE)</option>
            <option value="AUTH">การยืนยันตัวตน (AUTH)</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">วัน-เวลา (Timestamp)</th>
                <th className="py-3.5 px-4">ผู้ดำเนินการ (Actor)</th>
                <th className="py-3.5 px-4">บทบาท (Role)</th>
                <th className="py-3.5 px-4">การกระทำ (Action)</th>
                <th className="py-3.5 px-4">เป้าหมาย (Entity)</th>
                <th className="py-3.5 px-4">IP Address</th>
                <th className="py-3.5 px-4 text-right">รายละเอียด JSON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    กำลังโหลดประวัติ Audit Log...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                    ไม่พบรายการประวัติ
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('th-TH')}
                    </td>
                    <td className="py-3.5 px-4 font-sans font-bold text-slate-800 dark:text-slate-200">
                      {log.user_name || 'System'}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      {log.user_role ? (
                        <RoleBadge role={log.user_role} size="sm" />
                      ) : (
                        <span className="text-slate-400">SYSTEM</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded border border-brand-200 dark:border-brand-900">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                      <span className="font-bold">{log.entity_type}</span> {log.entity_id ? `#${log.entity_id}` : ''}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 text-slate-700 hover:text-brand-600 text-xs font-semibold transition-colors"
                      >
                        <Code className="w-3.5 h-3.5" />
                        ดู JSON
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload Viewer Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`รายละเอียดการบันทึก Audit #${selectedLog?.id} [${selectedLog?.action}]`}
        maxWidth="2xl"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-400">ผู้ดำเนินการ:</span>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedLog.user_name} ({selectedLog.user_role})
                </div>
              </div>
              <div>
                <span className="text-slate-400">วัน-เวลา:</span>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {new Date(selectedLog.created_at).toLocaleString('th-TH')}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Action:</span>
                <div className="font-mono font-bold text-brand-600 mt-0.5">{selectedLog.action}</div>
              </div>
              <div>
                <span className="text-slate-400">Entity:</span>
                <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedLog.entity_type} {selectedLog.entity_id ? `(#${selectedLog.entity_id})` : ''}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                JSON Payload & Request Diff:
              </label>
              <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800 max-h-72">
                {JSON.stringify(parseJson(selectedLog.detail_json), null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
