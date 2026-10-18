export { cn } from "cn"



export async function handleApi<T>(promise: Promise<Response>): Promise<T> {
  const res = await promise;
  let json: any;

  try {
    json = await res.json();
  } catch (parseError) {
    // ФИКС: Если сервер вместо JSON выплюнул HTML-ошибку (<!DOCTYPE...), 
    // мы перехватываем этот момент и пишем красивую фразу для клиента
    throw new Error("Не удалось связаться с сервером. Попробуйте позже");
  }

  // Если запрос вернулся с плохим HTTP статусом или флагом неуспеха
  if (!res.ok || !json || !json.success) {
    throw new Error(json?.error || `Ошибка сервера: ${res.status}`);
  }

  // Возвращаем чистые данные
  return json.data as T;
}
