// Casos de prueba de .semgrep/rules.yml para componentes React (semgrep --test).
import { useBooks } from '../hooks/useBooks'

// ---------- biblioteca-fetch-en-componentes ----------
export function BookListWrong() {
  // ruleid: biblioteca-fetch-en-componentes
  fetch('/api/books').then((res) => res.json())
  return <ul />
}

export function BookList() {
  // ok: biblioteca-fetch-en-componentes
  const { books } = useBooks()
  return <ul>{books.map((book) => <li key={book.id}>{book.title}</li>)}</ul>
}

// ---------- biblioteca-no-dangerously-set-inner-html ----------
export function TitleWrong({ html }: { html: string }) {
  // ruleid: biblioteca-no-dangerously-set-inner-html
  return <h2 dangerouslySetInnerHTML={{ __html: html }} />
}

export function Title({ text }: { text: string }) {
  // ok: biblioteca-no-dangerously-set-inner-html
  return <h2>{text}</h2>
}
