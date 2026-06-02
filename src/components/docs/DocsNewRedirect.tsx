import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { docsRepository } from './docs-repository';

export default function DocsNewRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    async function create() {
      const bundle = await docsRepository.createDoc('blank');
      navigate(`/docs/${bundle.doc.id}`, { replace: true });
    }

    void create();
  }, [navigate]);

  return <div className="flex h-full items-center justify-center bg-[#07090d] text-zinc-400">Creating document…</div>;
}
