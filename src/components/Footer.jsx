const EMAIL = 'siddharthranjan0909@gmail.com';

export default function Footer() {
  return (
    <footer className="cta">
      <div className="wrap cta-in">
        <div>
          <h2>Open to backend roles</h2>
          <p className="contact">
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            <span aria-hidden="true">·</span> India
          </p>
        </div>
        <div className="cta-btns">
          <a className="btn btn-solid" href="#contact">Email me</a>
          <a className="btn" href="https://github.com/siddharth-ranjan" target="_blank" rel="noopener">GitHub</a>
          <a className="btn" href="https://www.linkedin.com/in/siddharth-ranjan09/" target="_blank" rel="noopener">LinkedIn</a>
          <a className="btn" href="https://leetcode.com/u/sid0909/" target="_blank" rel="noopener">LeetCode</a>
        </div>
      </div>
    </footer>
  );
}
