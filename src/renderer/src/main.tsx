import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import App from './App';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Settings from './pages/Settings';
import Dashboard from './pages/Dashboard';
import FlowBuilder from './pages/FlowBuilder';
import './index.css';

const root = document.getElementById('root');

if (root) {
    render(() => (
        <Router root={App}>
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/" component={Dashboard}>
                <Route path="/" component={Home} />
                <Route path="/settings" component={Settings} />
                <Route path="/automations" component={FlowBuilder} />
            </Route>
        </Router>
    ), root);
}
