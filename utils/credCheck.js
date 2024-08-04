
export async function APIkeyWorks(url, api_key) {

  const full_url = `${url}/api/v1/assessments/queries`;

  try {
    const res = await fetch(full_url, {
      headers: {
        Authorization: `Bearer ${api_key}`
      },
    });

    if (res.ok) {
      return true;
    } else {
      console.error(`The API request failed with status: ${res.status}`);
      return false;
    }
  } catch(e) {
    throw new Error(e);
  }
}
