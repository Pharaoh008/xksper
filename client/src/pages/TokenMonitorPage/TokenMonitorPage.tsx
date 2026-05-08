import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableProps } from '@lark-apaas/client-toolkit/antd-table';
import { getGlobalTokenOverview } from '@/api';
import type {
  GlobalTokenOverviewResp,
  UserTokenStat,
  ModelUsage,
  AgentTokenStat,
  WorkflowTokenStat,
  OrganizationTokenStat,
  RoleTokenStat,
} from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  CalendarIcon,
  CoinsIcon,
  HashIcon,
  UsersIcon,
  ActivityIcon,
  TrendingUpIcon,
  Bot,
  Workflow,
  Building2,
  Shield,
} from 'lucide-react';
import { UserDisplay } from '@/components/business-ui/user-display';

// 更醒目的配色方案
const CHART_COLORS = [
  '#3B82F6', // 蓝色
  '#10B981', // 绿色
  '#F59E0B', // 橙色
  '#8B5CF6', // 紫色
  '#EF4444', // 红色
  '#06B6D4', // 青色
  '#6366F1', // 靛蓝
  '#EC4899', // 粉色
];

// 统计卡片配色
const STAT_CARD_STYLES = [
  { bg: 'bg-gradient-to-br from-blue-500 to-blue-600', iconBg: 'bg-blue-400/30', iconColor: 'text-white' },
  { bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600', iconBg: 'bg-emerald-400/30', iconColor: 'text-white' },
  { bg: 'bg-gradient-to-br from-violet-500 to-violet-600', iconBg: 'bg-violet-400/30', iconColor: 'text-white' },
  { bg: 'bg-gradient-to-br from-amber-500 to-amber-600', iconBg: 'bg-amber-400/30', iconColor: 'text-white' },
  { bg: 'bg-gradient-to-br from-rose-500 to-rose-600', iconBg: 'bg-rose-400/30', iconColor: 'text-white' },
  { bg: 'bg-gradient-to-br from-cyan-500 to-cyan-600', iconBg: 'bg-cyan-400/30', iconColor: 'text-white' },
];

const TokenMonitorPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ from?: dayjs.Dayjs; to?: dayjs.Dayjs }>({
    from: dayjs().subtract(7, 'day'),
    to: dayjs(),
  });
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const [globalData, setGlobalData] = useState<GlobalTokenOverviewResp | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchGlobalOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGlobalTokenOverview({
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      setGlobalData(data);
    } catch (error) {
      logger.error('获取全局Token概览失败', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange.from, dateRange.to]);

  useEffect(() => {
    fetchGlobalOverview();
  }, [fetchGlobalOverview]);

  const handleQuickSelect = (days: number) => {
    if (days === 0) {
      setDateRange({
        from: dayjs().subtract(1, 'day').startOf('day'),
        to: dayjs().subtract(1, 'day').endOf('day'),
      });
    } else {
      setDateRange({
        from: dayjs().subtract(days, 'day'),
        to: dayjs(),
      });
    }
  };

  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    setDateRange({
      from: range.from ? dayjs(range.from) : undefined,
      to: range.to ? dayjs(range.to) : undefined,
    });
  };

  const formatDateRange = () => {
    if (!dateRange.from) return '选择日期';
    const from = dateRange.from.format('MM-DD');
    const to = dateRange.to ? dateRange.to.format('MM-DD') : from;
    return `${from} ~ ${to}`;
  };

  const createPieOption = (data: { name: string; value: number }[], total: number): EChartsOption => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#E5E7EB',
      borderWidth: 1,
      textStyle: { color: '#1F2937' },
      formatter: (params) => {
        if (!params || typeof params === 'string') return '';
        const p = params as { name: string; value: number; percent: number; color: string };
        return `
          <div style="padding: 8px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};"></span>
              <strong>${p.name}</strong>
            </div>
            <div style="margin-left:18px;color:#6B7280;font-size:12px;">
              Token: <span style="color:#1F2937;font-weight:600;">${p.value.toLocaleString()}</span><br/>
              占比: <span style="color:#1F2937;font-weight:600;">${p.percent.toFixed(1)}%</span>
            </div>
          </div>
        `;
      },
    },
    legend: {
      bottom: 0,
      type: 'scroll',
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { color: '#4B5563', fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['45%', '75%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: { show: false },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
          },
        },
        data: data.map((item, index) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
        })),
      },
    ],
  });

  const userColumns: TableProps<UserTokenStat>['columns'] = [
    {
      title: '员工',
      dataIndex: 'userId',
      width: 220,
      fixed: 'left',
      render: (userId: string) => (
        <div className="flex items-center gap-2 py-1">
          <UserDisplay userId={userId} />
        </div>
      ),
    },
    {
      title: 'Token用量',
      dataIndex: 'totalTokens',
      width: 160,
      align: 'right',
      sorter: (a, b) => a.totalTokens - b.totalTokens,
      render: (tokens: number) => (
        <span className="font-mono text-sm font-semibold text-blue-600">{tokens.toLocaleString()}</span>
      ),
    },
    {
      title: '费用',
      dataIndex: 'totalCost',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.totalCost - b.totalCost,
      render: (cost: number) => (
        <span className="font-mono text-sm font-bold text-emerald-600">¥{cost.toFixed(2)}</span>
      ),
    },
    {
      title: '调用次数',
      dataIndex: 'callCount',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.callCount - b.callCount,
      render: (count: number) => (
        <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 font-semibold">{count}</Badge>
      ),
    },
    {
      title: '占比',
      dataIndex: 'totalTokens',
      width: 140,
      align: 'right',
      render: (tokens: number) => {
        const percent = globalData?.totalTokens ? (tokens / globalData.totalTokens) * 100 : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
            <span className="font-mono text-xs font-medium text-gray-600">{percent.toFixed(1)}%</span>
          </div>
        );
      },
    },
  ];

  const modelColumns: TableProps<ModelUsage>['columns'] = [
    {
      title: '模型',
      dataIndex: 'model',
      width: 200,
      fixed: 'left',
      render: (model: string) => (
        <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 font-semibold px-3 py-1">
          {model}
        </Badge>
      ),
    },
    {
      title: 'Token用量',
      dataIndex: 'tokens',
      width: 160,
      align: 'right',
      sorter: (a, b) => a.tokens - b.tokens,
      render: (tokens: number) => (
        <span className="font-mono text-sm font-semibold text-blue-600">{tokens.toLocaleString()}</span>
      ),
    },
    {
      title: '费用',
      dataIndex: 'cost',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.cost - b.cost,
      render: (cost: number) => (
        <span className="font-mono text-sm font-bold text-emerald-600">¥{cost.toFixed(2)}</span>
      ),
    },
    {
      title: '占比',
      dataIndex: 'percentage',
      width: 150,
      align: 'center',
      sorter: (a, b) => a.percentage - b.percentage,
      render: (percent: number) => (
        <div className="flex items-center gap-3">
          <div className="w-20 h-2.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="font-mono text-sm font-semibold text-gray-700">{percent.toFixed(1)}%</span>
        </div>
      ),
    },
  ];

  const agentColumns: TableProps<AgentTokenStat>['columns'] = [
    {
      title: 'Agent',
      dataIndex: 'agentName',
      width: 220,
      fixed: 'left',
      render: (name: string | null, record: AgentTokenStat) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-gray-800">{name || '未命名Agent'}</span>
        </div>
      ),
    },
    {
      title: 'Token用量',
      dataIndex: 'totalTokens',
      width: 160,
      align: 'right',
      sorter: (a, b) => a.totalTokens - b.totalTokens,
      render: (tokens: number) => (
        <span className="font-mono text-sm font-semibold text-blue-600">{tokens.toLocaleString()}</span>
      ),
    },
    {
      title: '费用',
      dataIndex: 'totalCost',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.totalCost - b.totalCost,
      render: (cost: number) => (
        <span className="font-mono text-sm font-bold text-emerald-600">¥{cost.toFixed(2)}</span>
      ),
    },
    {
      title: '调用次数',
      dataIndex: 'callCount',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.callCount - b.callCount,
      render: (count: number) => (
        <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 font-semibold">{count}</Badge>
      ),
    },
  ];

  const workflowColumns: TableProps<WorkflowTokenStat>['columns'] = [
    {
      title: 'Workflow',
      dataIndex: 'workflowName',
      width: 220,
      fixed: 'left',
      render: (name: string | null) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
            <Workflow className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-gray-800">{name || '未命名Workflow'}</span>
        </div>
      ),
    },
    {
      title: 'Token用量',
      dataIndex: 'totalTokens',
      width: 160,
      align: 'right',
      sorter: (a, b) => a.totalTokens - b.totalTokens,
      render: (tokens: number) => (
        <span className="font-mono text-sm font-semibold text-blue-600">{tokens.toLocaleString()}</span>
      ),
    },
    {
      title: '费用',
      dataIndex: 'totalCost',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.totalCost - b.totalCost,
      render: (cost: number) => (
        <span className="font-mono text-sm font-bold text-emerald-600">¥{cost.toFixed(2)}</span>
      ),
    },
    {
      title: '调用次数',
      dataIndex: 'callCount',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.callCount - b.callCount,
      render: (count: number) => (
        <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 font-semibold">{count}</Badge>
      ),
    },
  ];

  const orgColumns: TableProps<OrganizationTokenStat>['columns'] = [
    {
      title: '组织',
      dataIndex: 'orgName',
      width: 220,
      fixed: 'left',
      render: (name: string | null) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-gray-800">{name || '未分配组织'}</span>
        </div>
      ),
    },
    {
      title: 'Token用量',
      dataIndex: 'totalTokens',
      width: 160,
      align: 'right',
      sorter: (a, b) => a.totalTokens - b.totalTokens,
      render: (tokens: number) => (
        <span className="font-mono text-sm font-semibold text-blue-600">{tokens.toLocaleString()}</span>
      ),
    },
    {
      title: '费用',
      dataIndex: 'totalCost',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.totalCost - b.totalCost,
      render: (cost: number) => (
        <span className="font-mono text-sm font-bold text-emerald-600">¥{cost.toFixed(2)}</span>
      ),
    },
    {
      title: '用户数',
      dataIndex: 'userCount',
      width: 110,
      align: 'center',
      sorter: (a, b) => (a.userCount || 0) - (b.userCount || 0),
      render: (count: number) => (
        <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100 font-semibold">{count || 0}</Badge>
      ),
    },
  ];

  const roleColumns: TableProps<RoleTokenStat>['columns'] = [
    {
      title: '角色',
      dataIndex: 'roleName',
      width: 220,
      fixed: 'left',
      render: (name: string | null) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-gray-800">{name || '未分配角色'}</span>
        </div>
      ),
    },
    {
      title: 'Token用量',
      dataIndex: 'totalTokens',
      width: 160,
      align: 'right',
      sorter: (a, b) => a.totalTokens - b.totalTokens,
      render: (tokens: number) => (
        <span className="font-mono text-sm font-semibold text-blue-600">{tokens.toLocaleString()}</span>
      ),
    },
    {
      title: '费用',
      dataIndex: 'totalCost',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.totalCost - b.totalCost,
      render: (cost: number) => (
        <span className="font-mono text-sm font-bold text-emerald-600">¥{cost.toFixed(2)}</span>
      ),
    },
    {
      title: '覆盖用户',
      dataIndex: 'userCount',
      width: 110,
      align: 'center',
      sorter: (a, b) => (a.userCount || 0) - (b.userCount || 0),
      render: (count: number) => (
        <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 font-semibold">{count || 0}</Badge>
      ),
    },
  ];

  interface StatCardProps {
    icon: React.ElementType;
    title: string;
    value: string | number;
    index: number;
    isCurrency?: boolean;
  }

  const StatCard = ({ icon: Icon, title, value, index, isCurrency }: StatCardProps) => {
    const style = STAT_CARD_STYLES[index % STAT_CARD_STYLES.length];
    return (
      <Card className={`${style.bg} border-0 shadow-lg overflow-hidden`}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
              <div className="text-2xl font-bold text-white font-mono">
                {loading ? (
                  <span className="text-white/60">--</span>
                ) : isCurrency ? (
                  <span className="text-emerald-300">¥{value}</span>
                ) : (
                  value
                )}
              </div>
            </div>
            <div className={`w-12 h-12 ${style.iconBg} rounded-xl flex items-center justify-center`}>
              <Icon className={`h-6 w-6 ${style.iconColor}`} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const formatNumber = (num: number) => num.toLocaleString();
  const formatCurrency = (num: number) => num.toFixed(2);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Token监控中心</h1>
        <p className="text-gray-500 text-sm mt-1">多维度Token消耗统计与费用分析</p>
      </div>

      {/* 日期选择器 */}
      <Card className="mb-6 border-gray-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">日期范围:</span>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[180px] justify-start border-gray-300 hover:border-blue-400 hover:bg-blue-50">
                    <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                    {formatDateRange()}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{
                      from: dateRange.from?.toDate(),
                      to: dateRange.to?.toDate(),
                    }}
                    onSelect={(range) => {
                      handleDateRangeChange({ from: range?.from, to: range?.to });
                      if (range?.from && range?.to) {
                        setDatePickerOpen(false);
                      }
                    }}
                    numberOfMonths={2}
                    disabled={(date) => date > new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">快捷选择:</span>
              <div className="flex gap-2">
                {[
                  { label: '昨日', days: 0 },
                  { label: '近7天', days: 7 },
                  { label: '近30天', days: 30 },
                  { label: '近90天', days: 90 },
                ].map(({ label, days }) => (
                  <Button
                    key={days}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickSelect(days)}
                    className="border-gray-300 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          icon={HashIcon}
          title="总Token"
          value={loading ? '--' : formatNumber(globalData?.totalTokens || 0)}
          index={0}
        />
        <StatCard
          icon={CoinsIcon}
          title="总费用"
          value={loading ? '--' : formatCurrency(globalData?.totalCost || 0)}
          index={1}
          isCurrency
        />
        <StatCard
          icon={UsersIcon}
          title="员工数"
          value={loading ? '--' : globalData?.totalUsers || 0}
          index={2}
        />
        <StatCard
          icon={ActivityIcon}
          title="调用次数"
          value={loading ? '--' : formatNumber(globalData?.totalCalls || 0)}
          index={3}
        />
        <StatCard
          icon={TrendingUpIcon}
          title="模型数"
          value={loading ? '--' : globalData?.modelUsage?.length || 0}
          index={4}
        />
        <StatCard
          icon={Bot}
          title="Agent数"
          value={loading ? '--' : globalData?.agentStats?.length || 0}
          index={5}
        />
      </div>

      {/* Tab切换 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 bg-gray-100 p-1">
          {[
            { value: 'overview', label: '📊 概览' },
            { value: 'users', label: '👤 人员' },
            { value: 'models', label: '🤖 模型' },
            { value: 'agents', label: '🦾 Agent' },
            { value: 'workflows', label: '⚡ Workflow' },
            { value: 'organizations', label: '🏢 组织' },
            { value: 'roles', label: '🛡️ 角色' },
          ].map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 概览Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* 人员TOP5 */}
            <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <UsersIcon className="h-4 w-4 text-white" />
                  </div>
                  人员消耗TOP5
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="h-[280px] flex items-center justify-center text-gray-400">加载中...</div>
                ) : globalData?.userStats?.length ? (
                  <ReactECharts
                    option={createPieOption(
                      globalData.userStats.slice(0, 5).map((u) => ({ name: u.userId.slice(0, 8), value: u.totalTokens })),
                      globalData.totalTokens
                    )}
                    theme="ud"
                    className="h-[280px] w-full"
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400">暂无数据</div>
                )}
              </CardContent>
            </Card>

            {/* 模型分布 */}
            <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <TrendingUpIcon className="h-4 w-4 text-white" />
                  </div>
                  模型用量分布
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="h-[280px] flex items-center justify-center text-gray-400">加载中...</div>
                ) : globalData?.modelUsage?.length ? (
                  <ReactECharts
                    option={createPieOption(
                      globalData.modelUsage.map((m) => ({ name: m.model, value: m.tokens })),
                      globalData.totalTokens
                    )}
                    theme="ud"
                    className="h-[280px] w-full"
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400">暂无数据</div>
                )}
              </CardContent>
            </Card>

            {/* Agent TOP5 */}
            <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  Agent消耗TOP5
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="h-[280px] flex items-center justify-center text-gray-400">加载中...</div>
                ) : globalData?.agentStats?.length ? (
                  <ReactECharts
                    option={createPieOption(
                      globalData.agentStats.slice(0, 5).map((a) => ({ name: a.agentName || '未命名', value: a.totalTokens })),
                      globalData.totalTokens
                    )}
                    theme="ud"
                    className="h-[280px] w-full"
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400">暂无数据</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 组织TOP5 */}
            <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-white" />
                  </div>
                  组织消耗TOP5
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="h-[280px] flex items-center justify-center text-gray-400">加载中...</div>
                ) : globalData?.organizationStats?.length ? (
                  <ReactECharts
                    option={createPieOption(
                      globalData.organizationStats.slice(0, 5).map((o) => ({ name: o.orgName || '未分配', value: o.totalTokens })),
                      globalData.totalTokens
                    )}
                    theme="ud"
                    className="h-[280px] w-full"
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400">暂无数据</div>
                )}
              </CardContent>
            </Card>

            {/* 角色TOP5 */}
            <Card className="border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3 border-b border-gray-100">
                <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  角色消耗TOP5
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="h-[280px] flex items-center justify-center text-gray-400">加载中...</div>
                ) : globalData?.roleStats?.length ? (
                  <ReactECharts
                    option={createPieOption(
                      globalData.roleStats.slice(0, 5).map((r) => ({ name: r.roleName || '未分配', value: r.totalTokens })),
                      globalData.totalTokens
                    )}
                    theme="ud"
                    className="h-[280px] w-full"
                  />
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-gray-400">暂无数据</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 人员明细 */}
        <TabsContent value="users">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="text-lg font-bold text-gray-800">人员消耗明细</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table
                columns={userColumns}
                dataSource={globalData?.userStats || []}
                loading={loading}
                rowKey="userId"
                scroll={{ x: 800, y: 550 }}
                pagination={false}
                className="token-table"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 模型明细 */}
        <TabsContent value="models">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="text-lg font-bold text-gray-800">模型消耗明细</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table
                columns={modelColumns}
                dataSource={globalData?.modelUsage || []}
                loading={loading}
                rowKey="model"
                scroll={{ x: 700, y: 550 }}
                pagination={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Agent明细 */}
        <TabsContent value="agents">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="text-lg font-bold text-gray-800">Agent消耗明细</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table
                columns={agentColumns}
                dataSource={globalData?.agentStats || []}
                loading={loading}
                rowKey="agentId"
                scroll={{ x: 700, y: 550 }}
                pagination={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow明细 */}
        <TabsContent value="workflows">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="text-lg font-bold text-gray-800">Workflow消耗明细</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table
                columns={workflowColumns}
                dataSource={globalData?.workflowStats || []}
                loading={loading}
                rowKey="workflowId"
                scroll={{ x: 700, y: 550 }}
                pagination={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 组织明细 */}
        <TabsContent value="organizations">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="text-lg font-bold text-gray-800">组织消耗明细</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table
                columns={orgColumns}
                dataSource={globalData?.organizationStats || []}
                loading={loading}
                rowKey="orgId"
                scroll={{ x: 700, y: 550 }}
                pagination={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 角色明细 */}
        <TabsContent value="roles">
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50">
              <CardTitle className="text-lg font-bold text-gray-800">角色消耗明细</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table
                columns={roleColumns}
                dataSource={globalData?.roleStats || []}
                loading={loading}
                rowKey="roleId"
                scroll={{ x: 700, y: 550 }}
                pagination={false}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TokenMonitorPage;
