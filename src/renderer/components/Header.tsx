import React from 'react';
import './Header.css';

interface HeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  activeCount: number;
}

const Header: React.FC<HeaderProps> = ({ searchTerm, onSearchChange, activeCount }) => {
  return (
    <div className="header">
      <div className="header-title">
        <span className="header-icon">🔥</span>
        <span className="header-text">Killall-Tofu</span>
        {activeCount > 0 && (
          <span className="active-badge">{activeCount}</span>
        )}
      </div>
      
      <div className="search-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
};

export default Header;