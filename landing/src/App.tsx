import { Hero } from './components/Hero';
import { HowItRuns } from './components/HowItRuns';
import { Footer } from './components/Footer';

export default function App() {
  return (
    <>
      <main>
        <Hero />
        <HowItRuns />
      </main>
      <Footer />
    </>
  );
}
