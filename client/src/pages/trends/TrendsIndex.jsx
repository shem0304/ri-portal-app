import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import TrendsPage from '../TrendsPage.jsx';
import Overview from './Overview.jsx';
import Keywords from './Keywords.jsx';
import Topics from './Topics.jsx';
import TimeSeries from './TimeSeries.jsx';
import RisingBurst from './RisingBurst.jsx';
import WordCloud from './WordCloud.jsx';
import Network from './Network.jsx';
import Heatmap from './Heatmap.jsx';
import RelatedReports from './RelatedReports.jsx';

export default function TrendsIndex() {
  return (
    <Routes>
      <Route element={<TrendsPage />}>
        <Route index element={<Overview />} />
        <Route path="keywords" element={<Keywords />} />
        <Route path="topics" element={<Topics />} />
        <Route path="timeseries" element={<TimeSeries />} />
        <Route path="rising" element={<RisingBurst />} />
        <Route path="wordcloud" element={<WordCloud />} />
        <Route path="network" element={<Network />} />
        <Route path="heatmap" element={<Heatmap />} />
        <Route path="related" element={<RelatedReports />} />
        <Route path="*" element={<Navigate to="/trends" replace />} />
      </Route>
    </Routes>
  );
}
