import React, { useEffect } from 'react';
import type { ViewId } from '../shared/types.ts';
import { Icon, type IconName } from './Icons.tsx';

export const NAV_ITEMS: ReadonlyArray<{ id: ViewId; label: string; icon: IconName; hasDot?: boolean }> = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'plan', label: 'My daily plan', icon: 'calendar' },
  { id: 'indoor', label: 'Indoor air guide', icon: 'home' },
  { id: 'scene3d', label: '3D Smog Twin', icon: 'cube' },
  { id: 'impact', label: 'Impact lab', icon: 'leaf' },
  { id: 'copilot', label: 'Ask SmogSafe AI', icon: 'message', hasDot: true },
];

interface SidebarProps {
  activeView: ViewId;
  mobileOpen: boolean;
  onSelectView: (view: ViewId) => void;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  mobileOpen,
  onSelectView,
  onCloseMobile,
}) => {
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop open"
          aria-label="Close navigation menu"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`sidebar${mobileOpen ? ' open' : ''}`}
        id="sidebar"
        aria-label="Main navigation"
      >
        <div className="brand">
          <span className="brand-symbol">
            <Icon name="wind" />
          </span>
          <span>
            <strong>
              smogsafe<span className="brand-dot">.</span>
            </strong>
            <small>Family air intelligence</small>
          </span>
        </div>

        <div className="sidebar-caption">YOUR WORKSPACE</div>

        <nav className="side-nav" aria-label="Sections">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item${isActive ? ' active' : ''}`}
                data-view={item.id}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectView(item.id)}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {item.hasDot && <span className="nav-indicator" aria-hidden="true" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-spacer" />

        <div className="side-guide">
          <div className="side-guide-icon">
            <Icon name="shield" />
          </div>
          <strong>Small changes, cleaner choices.</strong>
          <p>Personalized advice for the people and places that matter most.</p>
          <button
            type="button"
            className="guide-link"
            id="nav-to-plan"
            onClick={() => onSelectView('plan')}
          >
            Create your plan <Icon name="arrow" />
          </button>
        </div>

        <div className="sidebar-bottom">
          <span className="status-dot" aria-hidden="true" />
          <span>SmogSafe AI v2.0</span>
          <span className="side-bottom-right">Verified logic</span>
        </div>
      </aside>
    </>
  );
};
