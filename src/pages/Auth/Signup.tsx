import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

type ContactMethod = 'email' | 'mobile';

type SignupFormData = {
  name: string;
  email: string;
  mobile: string;
  password: string;
  confirm: string;
};

const Signup = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [contactMethod, setContactMethod] = useState<ContactMethod>('email');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>();

  const onSubmit = async (data: SignupFormData) => {
    await signup(
      data.name,
      data.password,
      contactMethod === 'email'
        ? { email: data.email }
        : { mobile: data.mobile }
    );
    navigate('/dashboard');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span>💸</span>
          <h1>SplitWise</h1>
        </div>
        <p className="auth-tagline">Create your free account</p>

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              className={`form-control${errors.name ? ' input-error' : ''}`}
              type="text"
              placeholder="John Doe"
              {...register('name', {
                required: 'Full name is required',
                minLength: { value: 2, message: 'Name must be at least 2 characters' },
                maxLength: { value: 50, message: 'Name must not exceed 50 characters' },
              })}
            />
            {errors.name && <p className="form-error">{errors.name.message}</p>}
          </div>

          {/* Toggle: Email vs Mobile */}
          <div className="form-group">
            <div className="auth-toggle">
              <button
                type="button"
                className={`auth-toggle-btn${contactMethod === 'email' ? ' active' : ''}`}
                onClick={() => setContactMethod('email')}
              >
                Email
              </button>
              <button
                type="button"
                className={`auth-toggle-btn${contactMethod === 'mobile' ? ' active' : ''}`}
                onClick={() => setContactMethod('mobile')}
              >
                Mobile Number
              </button>
            </div>
          </div>

          {contactMethod === 'email' ? (
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className={`form-control${errors.email ? ' input-error' : ''}`}
                type="email"
                placeholder="you@example.com"
                {...register('email', {
                  required: contactMethod === 'email' ? 'Email is required' : false,
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email' },
                })}
              />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <input
                className={`form-control${errors.mobile ? ' input-error' : ''}`}
                type="tel"
                placeholder="9876543210"
                {...register('mobile', {
                  required: contactMethod === 'mobile' ? 'Mobile number is required' : false,
                  pattern: {
                    value: /^[6-9]\d{9}$/,
                    message: 'Enter a valid 10-digit mobile number',
                  },
                })}
              />
              {errors.mobile && <p className="form-error">{errors.mobile.message}</p>}
            </div>
          )}

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className={`form-control${errors.password ? ' input-error' : ''}`}
                type="password"
                placeholder="••••••••"
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'At least 6 characters' },
                })}
              />
              {errors.password && <p className="form-error">{errors.password.message}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Confirm</label>
              <input
                className={`form-control${errors.confirm ? ' input-error' : ''}`}
                type="password"
                placeholder="••••••••"
                {...register('confirm', {
                  required: 'Please confirm your password',
                  validate: (val: string) =>
                    val === watch('password') || 'Passwords do not match',
                })}
              />
              {errors.confirm && <p className="form-error">{errors.confirm.message}</p>}
            </div>
          </div>

          <button
            className="btn btn-primary w-full auth-submit"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
