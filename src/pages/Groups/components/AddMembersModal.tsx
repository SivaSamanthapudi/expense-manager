import { useState, useRef, useEffect, type FC } from 'react';
import Modal from '../../../components/modal/Modal';
import { type Member } from '../../../types';
import {
  groupService,
  type UserSuggestion,
} from '../../../services/groupService';
import useDebounce from '../../../hooks/useDebounce';

interface PendingMember {
  key: string;
  userId: string | null;
  name: string;
  email: string;
  mobile?: string;
  avatar: string;
  isRegistered: boolean;
  locked: boolean;
}

interface ExistingPoolEntry {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  avatar: string;
  userId: string | null;
}

interface Props {
  isOpen: boolean;
  groupMembers: Member[];
  existingPool: ExistingPoolEntry[];
  adding: boolean;
  error: string;
  onClose: () => void;
  onAdd: (pending: PendingMember[]) => Promise<void>;
}

const AddMembersModal: FC<Props> = ({
  isOpen,
  groupMembers,
  existingPool,
  adding,
  error,
  onClose,
  onAdd,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [pending, setPending] = useState<PendingMember[]>([]);
  const [manualForm, setManualForm] = useState({
    name: '',
    email: '',
    mobile: '',
    contactMethod: 'email' as 'email' | 'mobile',
  });
  const [manualError, setManualError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');
  const [suggestionRect, setSuggestionRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const resetState = () => {
    setPending([]);
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchDone(false);
    setShowManual(false);
    setManualForm({ name: '', email: '', mobile: '', contactMethod: 'email' });
    setManualError('');
    setInfoMsg('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const isAlreadyPending = (candidate: {
    userId?: string | null;
    email?: string;
    mobile?: string;
  }) =>
    pending.some((p) => {
      if (candidate.userId && p.userId && candidate.userId === p.userId)
        return true;
      if (
        candidate.email &&
        candidate.email.trim() !== '' &&
        p.email &&
        p.email.toLowerCase() === candidate.email.toLowerCase()
      )
        return true;
      if (
        candidate.mobile &&
        candidate.mobile.trim() !== '' &&
        p.mobile &&
        p.mobile.trim() === candidate.mobile.trim()
      )
        return true;
      return false;
    });

  useEffect(() => {
    if (debouncedSearch.trim().length < 2) {
      setSuggestions([]);
      setSearchDone(false);
      return;
    }
    let cancelled = false;
    groupService
      .searchUsers(debouncedSearch.trim())
      .then((results) => {
        if (cancelled) return;
        const filtered = results.filter(
          (u) =>
            !groupMembers.some((m) => m.userId === u.id) &&
            !pending.some((p) => p.userId === u.id)
        );
        setSuggestions(filtered);
        if (filtered.length > 0) {
          const rect = searchInputRef.current?.getBoundingClientRect();
          if (rect)
            setSuggestionRect({
              top: rect.bottom + 4,
              left: rect.left,
              width: rect.width,
            });
          setShowSuggestions(true);
        } else {
          setShowSuggestions(false);
        }
        setSearchDone(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSuggestions([]);
        setSearchDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(false);
    setSearchDone(false);
    if (value.trim().length < 2) setSuggestions([]);
  };

  const pickSuggestion = (u: UserSuggestion) => {
    setPending((prev) => {
      const withoutConflicts = prev.filter((p) => {
        if (
          u.email &&
          p.email &&
          p.email.toLowerCase() === u.email.toLowerCase()
        )
          return false;
        if (u.mobile && p.mobile && p.mobile.trim() === u.mobile.trim())
          return false;
        return true;
      });
      return [
        ...withoutConflicts,
        {
          key: u.id,
          userId: u.id,
          name: u.name,
          email: u.email || u.mobile,
          avatar: u.avatar,
          isRegistered: true,
          locked: true,
        },
      ];
    });
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchDone(false);
  };

  const removePending = (key: string) =>
    setPending((prev) => prev.filter((p) => p.key !== key));

  const addManualMember = async () => {
    const name = manualForm.name.trim();
    const email = manualForm.email.trim().toLowerCase();
    const mobile = manualForm.mobile.trim();
    if (!name) {
      setManualError('Name is required');
      return;
    }
    if (manualForm.contactMethod === 'email' && !email) {
      setManualError('Email is required');
      return;
    }
    if (manualForm.contactMethod === 'mobile' && !mobile) {
      setManualError('Mobile number is required');
      return;
    }
    if (manualForm.contactMethod === 'mobile' && !/^[6-9]\d{9}$/.test(mobile)) {
      setManualError('Enter a valid 10-digit mobile number');
      return;
    }
    if (email && isAlreadyPending({ email })) {
      setManualError('A member with this email is already in the list');
      return;
    }
    if (mobile && isAlreadyPending({ mobile })) {
      setManualError('A member with this mobile number is already in the list');
      return;
    }
    setManualError('');

    const contact =
      manualForm.contactMethod === 'email' ? { email } : { mobile };
    const registered = await groupService.lookupUser(contact);
    const newEntry: PendingMember = registered
      ? {
          key: registered.id,
          userId: registered.id,
          name: registered.name,
          email: registered.email,
          mobile: registered.mobile || undefined,
          avatar: registered.avatar,
          isRegistered: true,
          locked: true,
        }
      : {
          key: `manual_${Date.now()}`,
          userId: null,
          name,
          email: manualForm.contactMethod === 'email' ? email : '',
          mobile: manualForm.contactMethod === 'mobile' ? mobile : undefined,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
            name
          )}`,
          isRegistered: false,
          locked: false,
        };

    setPending((prev) => {
      const withoutConflicts = prev.filter((p) => {
        if (email && p.email && p.email.toLowerCase() === email) return false;
        if (mobile && p.mobile && p.mobile.trim() === mobile) return false;
        return true;
      });
      return [...withoutConflicts, newEntry];
    });

    if (registered) {
      setInfoMsg(
        `ℹ️ ${name} is registered on SplitWise — added as registered user.`
      );
      setTimeout(() => setInfoMsg(''), 4000);
    }
    setManualForm({
      name: '',
      email: '',
      mobile: '',
      contactMethod: manualForm.contactMethod,
    });
    setShowManual(false);
    setSearchQuery('');
    setSearchDone(false);
  };

  const handleSubmit = async () => {
    await onAdd(pending);
    resetState();
  };

  const noMatch =
    searchDone &&
    searchQuery.trim().length >= 2 &&
    suggestions.length === 0 &&
    !showSuggestions;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Members"
      size="sm"
      footer={
        <>
          <button
            className="btn btn-outline"
            onClick={handleClose}
            disabled={adding}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void handleSubmit()}
            disabled={adding || pending.length === 0}
          >
            {adding
              ? 'Adding…'
              : `Add ${pending.length > 0 ? `${pending.length} ` : ''}Member${
                  pending.length !== 1 ? 's' : ''
                }`}
          </button>
        </>
      }
    >
      {existingPool.length > 0 && (
        <div className="form-group">
          <label className="form-label">Add from existing members</label>
          <div className="existing-members-grid">
            {existingPool.map((m) => {
              const picked = pending.some((p) => {
                if (m.userId && p.userId && m.userId === p.userId) return true;
                if (
                  m.email &&
                  m.email.trim() !== '' &&
                  p.email &&
                  p.email.toLowerCase() === m.email.toLowerCase()
                )
                  return true;
                if (
                  m.mobile &&
                  m.mobile.trim() !== '' &&
                  p.mobile &&
                  p.mobile.trim() === m.mobile!.trim()
                )
                  return true;
                return false;
              });
              return (
                <button
                  key={m.userId ?? m.id}
                  type="button"
                  className={`existing-member-chip ${picked ? 'picked' : ''}`}
                  onClick={() => {
                    if (picked) {
                      setPending((prev) =>
                        prev.filter((p) => {
                          if (m.userId && p.userId && m.userId === p.userId)
                            return false;
                          if (
                            m.email &&
                            m.email.trim() !== '' &&
                            p.email &&
                            p.email.toLowerCase() === m.email.toLowerCase()
                          )
                            return false;
                          if (
                            m.mobile &&
                            m.mobile.trim() !== '' &&
                            p.mobile &&
                            p.mobile.trim() === m.mobile!.trim()
                          )
                            return false;
                          return true;
                        })
                      );
                    } else {
                      setPending((prev) => {
                        const withoutConflicts = prev.filter((p) => {
                          if (
                            m.email &&
                            m.email.trim() !== '' &&
                            p.email &&
                            p.email.toLowerCase() === m.email.toLowerCase()
                          )
                            return false;
                          if (
                            m.mobile &&
                            m.mobile.trim() !== '' &&
                            p.mobile &&
                            p.mobile.trim() === m.mobile!.trim()
                          )
                            return false;
                          return true;
                        });
                        return [
                          ...withoutConflicts,
                          {
                            key: m.userId ?? m.id,
                            userId: m.userId,
                            name: m.name,
                            email: m.email,
                            mobile: m.mobile,
                            avatar: m.avatar,
                            isRegistered: !!m.userId,
                            locked: true,
                          },
                        ];
                      });
                    }
                  }}
                >
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className="avatar avatar-sm"
                  />
                  <div className="existing-member-info">
                    <span className="text-sm font-semibold">{m.name}</span>
                    <span className="text-xs text-muted">
                      {m.email || m.mobile}
                    </span>
                  </div>
                  <span className="chip-check">{picked ? '✓' : '+'}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {existingPool.length > 0 && <div className="divider" />}

      <div className="form-group" ref={suggestionsRef}>
        <label className="form-label">Search by name or email</label>
        <input
          ref={searchInputRef}
          className="form-control"
          placeholder="Type to search registered users…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              const rect = searchInputRef.current?.getBoundingClientRect();
              if (rect)
                setSuggestionRect({
                  top: rect.bottom + 4,
                  left: rect.left,
                  width: rect.width,
                });
              setShowSuggestions(true);
            }
          }}
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && suggestionRect && (
          <div
            className="member-suggestions"
            style={{
              position: 'fixed',
              top: suggestionRect.top,
              left: suggestionRect.left,
              width: suggestionRect.width,
              zIndex: 2000,
            }}
          >
            {suggestions.map((u) => (
              <button
                key={u.id}
                type="button"
                className="member-suggestion-item"
                onMouseDown={() => pickSuggestion(u)}
              >
                <img
                  src={u.avatar}
                  alt={u.name}
                  className="avatar"
                  style={{ width: 28, height: 28, flexShrink: 0 }}
                />
                <div className="member-suggestion-info">
                  <span className="member-suggestion-name">{u.name}</span>
                  <span className="member-suggestion-sub">
                    {u.email || u.mobile}
                  </span>
                </div>
                <span className="member-suggestion-add">+ Add</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {noMatch && !showManual && (
        <div className="member-not-found">
          <span className="member-not-found-text">
            <span className="member-not-found-icon">🔍</span>"
            <strong>{searchQuery}</strong>" is not registered in SplitWise
          </span>
          <div className="member-not-found-actions">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setManualForm({
                  name: searchQuery,
                  email: '',
                  mobile: '',
                  contactMethod: 'email',
                });
                setShowManual(true);
                setSearchQuery('');
                setSearchDone(false);
              }}
            >
              ✉️ Invite &amp; Add
            </button>
          </div>
        </div>
      )}

      {showManual && (
        <div className="manual-member-form">
          <div className="manual-member-header">
            <span className="text-sm font-semibold">
              Add unregistered member
            </span>
            <button
              type="button"
              className="btn-icon"
              onClick={() => {
                setShowManual(false);
                setManualForm({
                  name: '',
                  email: '',
                  mobile: '',
                  contactMethod: 'email',
                });
                setManualError('');
              }}
            >
              ✕
            </button>
          </div>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <input
              className="form-control"
              placeholder="Full name *"
              value={manualForm.name}
              onChange={(e) =>
                setManualForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <button
              type="button"
              className={`auth-toggle-btn${
                manualForm.contactMethod === 'email' ? ' active' : ''
              }`}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #e2e8f0',
              }}
              onClick={() =>
                setManualForm((f) => ({
                  ...f,
                  contactMethod: 'email',
                  mobile: '',
                }))
              }
            >
              Email
            </button>
            <button
              type="button"
              className={`auth-toggle-btn${
                manualForm.contactMethod === 'mobile' ? ' active' : ''
              }`}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid #e2e8f0',
              }}
              onClick={() =>
                setManualForm((f) => ({
                  ...f,
                  contactMethod: 'mobile',
                  email: '',
                }))
              }
            >
              Mobile
            </button>
          </div>
          {manualForm.contactMethod === 'email' ? (
            <div className="form-group" style={{ marginBottom: 8 }}>
              <input
                className="form-control"
                type="email"
                placeholder="Email address *"
                value={manualForm.email}
                onChange={(e) =>
                  setManualForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
          ) : (
            <div className="form-group" style={{ marginBottom: 8 }}>
              <input
                className="form-control"
                type="tel"
                placeholder="10-digit mobile number *"
                value={manualForm.mobile}
                onChange={(e) =>
                  setManualForm((f) => ({ ...f, mobile: e.target.value }))
                }
              />
            </div>
          )}
          {manualError && (
            <p className="form-error" style={{ marginBottom: 6 }}>
              {manualError}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-sm w-full"
            onClick={() => void addManualMember()}
          >
            Add to list
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="pending-members-section">
          <p className="form-label" style={{ marginBottom: 8 }}>
            To be added ({pending.length})
          </p>
          <div className="pending-members-list">
            {pending.map((p) => (
              <div
                key={p.key}
                className={`pending-member-chip ${
                  p.isRegistered ? 'registered' : 'unregistered'
                }`}
              >
                <img
                  src={p.avatar}
                  alt={p.name}
                  className="avatar"
                  style={{ width: 24, height: 24, flexShrink: 0 }}
                />
                <div className="pending-member-info">
                  <span className="pending-member-name">{p.name}</span>
                  {p.email && (
                    <span className="pending-member-email">{p.email}</span>
                  )}
                  {!p.email && p.mobile && (
                    <span className="pending-member-email">{p.mobile}</span>
                  )}
                  {!p.isRegistered && (
                    <span className="pending-member-badge">
                      Not in SplitWise · invite pending
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="pending-member-remove"
                  onClick={() => removePending(p.key)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(error || infoMsg) && (
        <p className="form-error" style={{ marginTop: 8 }}>
          {error || infoMsg}
        </p>
      )}
    </Modal>
  );
};

export default AddMembersModal;
