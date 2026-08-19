import React, { useState } from 'react';
import '../styles/pageStyles/Login.css';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logorot.png';

/**
 * @file Login.jsx
 * @description Login-Ansicht für Administratoren und autorisierte Mitarbeiter.
 *              Stellt ein Authentifizierungsformular mit Kennwortanzeige-Umschaltung bereit.
 * @module pages/Login
 */

/**
 * Login-Seitenkomponente.
 *
 * @component
 * @param {Object} props - Komponenten-Eigenschaften.
 * @param {Function} [props.onLoginSuccess] - Callback-Funktion bei erfolgreichem Login.
 * @param {Function} [props.onNavigateBack] - Callback-Funktion zur Rückkehr zum Buchungsportal.
 * @returns {JSX.Element} Das gerenderte Login-Formular.
 */
export default function Login({ onLoginSuccess, onNavigateBack }) {
  const navigate = useNavigate();

  /**
   * Formulardaten (Benutzername/E-Mail, Passwort, Merken).
   * @type {[Object, Function]}
   */
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    rememberMe: false
  });

  /**
   * Steuert, ob das Passwort im Klartext angezeigt werden soll.
   * @type {[boolean, Function]}
   */
  const [showPassword, setShowPassword] = useState(false);

  /**
   * Fehlermeldung bei Validierung oder Fehlversuch.
   * @type {[string|null, Function]}
   */
  const [errorMessage, setErrorMessage] = useState(null);

  /**
   * Ladezustand während der Übermittlung.
   * @type {[boolean, Function]}
   */
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Aktualisiert die Eingabewerte im State.
   *
   * @function
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input-Event.
   * @returns {void}
   */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  /**
   * Verarbeitet den Login-Submit.
   *
   * @async
   * @function
   * @param {React.FormEvent<HTMLFormElement>} e - Submit-Event.
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.identifier.trim()) {
      setErrorMessage('Bitte geben Sie Ihre E-Mail-Adresse oder Ihren Benutzernamen ein.');
      return;
    }

    if (!formData.password) {
      setErrorMessage('Bitte geben Sie Ihr Passwort ein.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    setTimeout(() => {
      setIsLoading(false);
      if (onLoginSuccess) {
        onLoginSuccess(formData);
      }
      navigate('/dashboard');
    }, 500);
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        {/* Header */}
        <div className="login-header">
          <img src={logo} alt="App Logo" className="login-logo" />
          <h1 className="login-title">Admin Login</h1>
          <p className="login-subtitle">Melden Sie sich an, um Buchungen und Objekte zu verwalten.</p>
        </div>

        {/* Fehlermeldung */}
        {errorMessage && (
          <div className="login-error-banner" role="alert">
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Formular */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {/* Benutzername / E-Mail */}
          <div className="login-form-group">
            <label htmlFor="identifier" className="login-label">
              Benutzername oder E-Mail
            </label>
            <input
              id="identifier"
              name="identifier"
              type="text"
              className={`login-input ${errorMessage && !formData.identifier ? 'input-error' : ''}`}
              placeholder="admin@beispiel.de"
              value={formData.identifier}
              onChange={handleChange}
              autoComplete="username"
              disabled={isLoading}
            />
          </div>

          {/* Passwort */}
          <div className="login-form-group">
            <label htmlFor="password" className="login-label">
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              className={`login-input ${errorMessage && !formData.password ? 'input-error' : ''}`}
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              disabled={isLoading}
            />

            <label className="login-checkbox-label" style={{ marginTop: '4px' }}>
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                disabled={isLoading}
              />
              <span>Passwort anzeigen</span>
            </label>
          </div>

          {/* Optionen: Angemeldet bleiben */}
          <div className="login-options-row">
            <label className="login-checkbox-label">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
                disabled={isLoading}
              />
              <span>Angemeldet bleiben</span>
            </label>
          </div>

          {/* Submit-Button */}
          <button type="submit" className="login-submit-btn" disabled={isLoading}>
            {isLoading ? 'Wird angemeldet...' : 'Anmelden'}
          </button>
        </form>

        {/* Zurück-Link */}
        {onNavigateBack && (
          <div className="login-footer">
            <button type="button" className="login-back-btn" onClick={onNavigateBack}>
              Zurück zum Buchungsportal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}