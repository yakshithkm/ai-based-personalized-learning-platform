import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../api/client';

const AnalyticsPage = () => {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/analytics/me');
        setPayload(data);
      } catch (err) {
        setError(err?.response?.data?.message || 'Failed to load analytics');
      }
    };

    load();
  }, []);

  const bySubject = payload?.attemptsBySubject || [];
  const trend = (payload?.recentAttempts || []).map((entry, index) => ({
    idx: index + 1,
    accuracy: entry.isCorrect ? 100 : 0,
    timeTakenSec: entry.timeTakenSec,
  }));

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Analytics</h2>
        <p>Visualize accuracy and speed trends across your attempt history.</p>
      </section>

      {error && <section className="panel error-text">{error}</section>}

      <section className="panel chart-panel">
        <h3>Subject-wise Accuracy (%)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={bySubject}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2b2b2b" />
            <XAxis dataKey="subject" stroke="#cccccc" />
            <YAxis stroke="#cccccc" />
            <Tooltip />
            <Bar dataKey="accuracy" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel chart-panel">
        <h3>Recent Accuracy Trend</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2b2b2b" />
            <XAxis dataKey="idx" stroke="#cccccc" />
            <YAxis stroke="#cccccc" />
            <Tooltip />
            <Line type="monotone" dataKey="accuracy" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </section>

      <section className="panel chart-panel">
        <h3>Recent Time Taken (sec)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2b2b2b" />
            <XAxis dataKey="idx" stroke="#cccccc" />
            <YAxis stroke="#cccccc" />
            <Tooltip />
            <Line type="monotone" dataKey="timeTakenSec" stroke="#3b82f6" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
};

export default AnalyticsPage;
