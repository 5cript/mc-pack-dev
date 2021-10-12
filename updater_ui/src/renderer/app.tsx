import React from 'react';
import { MemoryRouter as Router, Switch, Route } from 'react-router-dom';
import './App.global.css';
import MainWindow from './main_window/main_window';

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={MainWindow} />
      </Switch>
    </Router>
  );
}
