import { createRoot } from 'react-dom/client';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './app.global.css';
import Home from './Home';

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
  <Router>
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  </Router>
  );