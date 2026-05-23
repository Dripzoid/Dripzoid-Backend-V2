const LOGO_URL =
  "https://res.cloudinary.com/dvid0uzwo/image/upload/v1771150544/my_project/lk1uulpgg3gdgi2fyfbp.png";

// 📅 format date
function formatDate(dateStr) {
  if (!dateStr) return "-";

  const d = new Date(dateStr);

  if (isNaN(d)) return dateStr;

  const dd = String(
    d.getDate()
  ).padStart(2, "0");

  const mm = String(
    d.getMonth() + 1
  ).padStart(2, "0");

  const yyyy =
    d.getFullYear();

  return `${dd}-${mm}-${yyyy}`;
}

// ❌ invalid page
export function invalidCertificateHTML() {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Certificate Verification</title>

    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />

    <style>
      body{
        font-family:Arial;
        background:#020617;
        color:white;
        display:flex;
        justify-content:center;
        align-items:center;
        min-height:100vh;
      }

      .card{
        background:#111827;
        padding:40px;
        border-radius:20px;
        text-align:center;
      }
    </style>
  </head>

  <body>
    <div class="card">
      <img
        src="${LOGO_URL}"
        width="120"
      />

      <h2>
        ❌ Certificate Not Found
      </h2>

      <p>
        Invalid or revoked certificate
      </p>
    </div>
  </body>
  </html>
  `;
}

// ✅ valid page
export function validCertificateHTML(
  row
) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <title>
      Certificate Verification
    </title>

    <meta
      name="viewport"
      content="width=device-width, initial-scale=1"
    />

    <style>
      body{
        font-family:Arial;
        background:#020617;
        display:flex;
        justify-content:center;
        align-items:center;
        min-height:100vh;
        padding:20px;
      }

      .card{
        max-width:700px;
        width:100%;
        background:white;
        border-radius:20px;
        padding:40px;
        text-align:center;
      }

      .meta{
        margin-top:20px;
        text-align:left;
      }

      .meta div{
        margin-bottom:10px;
      }

      .btn{
        display:inline-block;
        margin-top:25px;
        background:black;
        color:white;
        padding:12px 20px;
        text-decoration:none;
        border-radius:12px;
      }
    </style>
  </head>

  <body>
    <div class="card">

      <img
        src="${LOGO_URL}"
        width="120"
      />

      <h2>
        ${row.intern_name}
      </h2>

      <div class="meta">
        <div>
          <strong>Role:</strong>
          ${row.role || "-"}
        </div>

        <div>
          <strong>Duration:</strong>
          ${formatDate(
            row.start_date
          )} →
          ${formatDate(
            row.end_date
          )}
        </div>

        <div>
          <strong>Issue Date:</strong>
          ${formatDate(
            row.issue_date
          )}
        </div>
      </div>

      <a
        class="btn"
        href="${row.certificate_url}"
        target="_blank"
      >
        View Certificate
      </a>

    </div>
  </body>
  </html>
  `;
}