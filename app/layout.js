import './globals.css';

export const metadata = {
  title: 'Government Services QA',
  description: 'Reusable government services quality assurance dashboard.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
