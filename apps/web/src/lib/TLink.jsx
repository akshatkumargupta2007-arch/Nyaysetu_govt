import React from 'react';
import { useNavigate } from 'react-router-dom';

// A normal <a> that moves to another screen without reloading the page.
export function TLink({ to, onClick, children, ...rest }) {
  const navigate = useNavigate();
  return (
    <a
      href={to}
      {...rest}
      onClick={(e) => {
        if (onClick) onClick(e);
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
