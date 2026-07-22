import { type FC } from 'react';
import './PageLoader.css';

interface Props {
  message?: string;
  fullPage?: boolean;
}

const PageLoader: FC<Props> = ({ message = 'Loading…', fullPage = false }) => (
  <div className={fullPage ? 'page-loader page-loader--full' : 'page-loader'}>
    <div className="spinner page-loader-spinner" />
    <p className="page-loader-text">{message}</p>
  </div>
);

export default PageLoader;
