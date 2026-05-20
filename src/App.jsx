import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

const STAGES = [
  { id: 0.25, label: "살짝 올라옴", desc: "분위기가 좋아지고 말이 조금 편해진 상태" },
  { id: 0.5, label: "알딸딸함", desc: "취기가 느껴지지만 아직 무리는 없는 상태" },
  { id: 0.75, label: "확실히 취함", desc: "말투·표정·반응에서 취기가 드러나는 상태" },
  { id: 1.0, label: "딱 주량", desc: "여기서 더 마시면 무리가 올 것 같은 한계 상태" },
  { id: 1.5, label: "개가 됨", desc: "기억과 행동 관리가 흔들리는 초과 상태" },
];

const DRINKS = [
  { id: "soju", name: "소주", unit: "병", abv: 16.5, factor: 1, note: "기준" },
  { id: "beer", name: "맥주", unit: "병/캔", abv: 4.5, factor: 0.27, note: "약 0.27소주" },
  { id: "whisky", name: "위스키", unit: "잔", abv: 40, factor: 0.4, note: "약 0.4소주" },
  { id: "wine", name: "와인", unit: "잔", abv: 13, factor: 0.16, note: "약 0.16소주" },
  { id: "makgeolli", name: "막걸리", unit: "병", abv: 6, factor: 0.36, note: "약 0.36소주" },
  { id: "custom", name: "직접 입력", unit: "잔", abv: null, factor: null, note: "칵테일 등" },
];

const SOJU_ABV = 16.5;
const SOJU_BOTTLE_ML = 360;
const DEFAULT_GLASS_ML = 45;

function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = () => formatDateLocal(new Date());
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const formatNum = (value) => (Number.isFinite(value) ? value.toFixed(2) : "0.00");
const formatPercent = (value) => {
  if (!Number.isFinite(value)) return "0.0%";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
};

function makeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function safeRead(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function safeWrite(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getDrinkFactor(drinkId, customAbv = 12, customGlassMl = DEFAULT_GLASS_ML) {
  const drink = DRINKS.find((item) => item.id === drinkId) || DRINKS[0];
  if (drink.id !== "custom") return drink.factor || 0;

  const abv = Number(customAbv);
  const glassMl = Number(customGlassMl) || DEFAULT_GLASS_ML;
  if (!abv) return 0;

  return (abv * glassMl) / (SOJU_ABV * SOJU_BOTTLE_ML);
}

function getMonthDays(dateString) {
  const base = new Date(`${dateString}T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days = [];

  for (let i = 0; i < first.getDay(); i += 1) days.push(null);
  for (let d = 1; d <= last.getDate(); d += 1) days.push(new Date(year, month, d));

  return { year, month, days };
}

function Card({ children, className = "" }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function AppButton({ children, className = "", disabled = false, onClick, type = "button" }) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`app-button ${className}`}>
      {children}
    </button>
  );
}

export default function App() {
  const [mode, setMode] = useState("login");
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [user, setUser] = useState(() => safeRead("julyang-current-user", null));

  const [records, setRecords] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [calendarMonth, setCalendarMonth] = useState(today());

  const [drinkId, setDrinkId] = useState("soju");
  const [amount, setAmount] = useState("1");
  const [customAbv, setCustomAbv] = useState("12");
  const [customGlassMl, setCustomGlassMl] = useState("45");
  const [drinkItems, setDrinkItems] = useState([]);

  const [hours, setHours] = useState("1");
  const [stage, setStage] = useState(1);
  const [memo, setMemo] = useState("");

  const [roomCode, setRoomCode] = useState("");
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomError, setRoomError] = useState("");
  const [roomTick, setRoomTick] = useState(0);
  const [screen, setScreen] = useState("main");
  const [myRooms, setMyRooms] = useState([]);

  const storageKey = user ? `julyang-records-${user.id}` : null;

  useEffect(() => {
    if (!user) return;
    setRecords(safeRead(`julyang-records-${user.id}`, []));
    setMyRooms(safeRead(`julyang-user-rooms-${user.id}`, []));
  }, [user]);

  useEffect(() => {
    if (!storageKey) return;
    safeWrite(storageKey, records);
  }, [records, storageKey]);

  const selectedDrink = DRINKS.find((drink) => drink.id === drinkId) || DRINKS[0];
  const isCustomDrink = drinkId === "custom";

  const currentFactor = useMemo(
    () => getDrinkFactor(drinkId, customAbv, customGlassMl),
    [drinkId, customAbv, customGlassMl]
  );

  const previewSojuAmount = useMemo(() => {
    const value = Number(amount);
    if (!value) return 0;
    return value * currentFactor;
  }, [amount, currentFactor]);

  const totalSojuAmount = useMemo(
    () => drinkItems.reduce((sum, item) => sum + item.sojuAmount, 0),
    [drinkItems]
  );

  const estimated = useMemo(() => {
    const h = Number(hours);
    const s = Number(stage);
    if (!totalSojuAmount || !h || !s) return 0;
    return (totalSojuAmount / h) / s;
  }, [totalSojuAmount, hours, stage]);

  const stats = useMemo(() => {
    const values = records
      .map((record) => record.capacityBph)
      .filter((value) => Number.isFinite(value) && value > 0);

    if (!values.length) return { current: estimated || 0, avg: 0, min: 0, max: 0 };

    return {
      current: values[values.length - 1],
      avg: values.reduce((sum, value) => sum + value, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [records, estimated]);

  const trendData = useMemo(() => {
    const values = records
      .filter((record) => Number.isFinite(record.capacityBph) && record.capacityBph > 0)
      .map((record) => ({ date: record.date.slice(5), value: record.capacityBph }));

    return values.map((item, index) => {
      const previous = values[index - 1];
      const valuesUntilNow = values.slice(0, index + 1).map((v) => v.value);
      const currentAverage = valuesUntilNow.reduce((sum, value) => sum + value, 0) / valuesUntilNow.length;
      const previousValues = values.slice(0, index).map((v) => v.value);
      const previousAverage = previousValues.length
        ? previousValues.reduce((sum, value) => sum + value, 0) / previousValues.length
        : 0;

      return {
        date: item.date,
        dailyRate: previous?.value > 0 ? ((item.value - previous.value) / previous.value) * 100 : 0,
        averageRate: previousAverage > 0 ? ((currentAverage - previousAverage) / previousAverage) * 100 : 0,
        capacity: item.value,
        average: currentAverage,
      };
    });
  }, [records]);

  const visibleTrendData = useMemo(() => trendData.slice(-6), [trendData]);

  const trend = useMemo(() => {
    if (trendData.length < 2) return { currentRate: 0, averageRate: 0 };
    const latest = trendData[trendData.length - 1];
    return {
      currentRate: latest.dailyRate,
      averageRate: latest.averageRate,
    };
  }, [trendData]);

  const hasSavedStats = stats.min > 0 && stats.max > 0;
  const rangeMin = hasSavedStats ? stats.min : 0;
  const rangeMax = hasSavedStats ? stats.max : 1;
  const gaugeValue = hasSavedStats ? stats.avg : 0;
  const isFlatRange = hasSavedStats && stats.min === stats.max;
  const ratio = isFlatRange ? 0.5 : clamp((gaugeValue - rangeMin) / (rangeMax - rangeMin), 0, 1);
  const angle = 180 - ratio * 180;
  const markerX = 160 + 118 * Math.cos((Math.PI * angle) / 180);
  const markerY = 150 - 118 * Math.sin((Math.PI * angle) / 180);

  const { year, month, days } = getMonthDays(calendarMonth);

  const recordByDate = useMemo(() => {
    return records.reduce((acc, record) => {
      acc[record.date] = record;
      return acc;
    }, {});
  }, [records]);

  const selectedRecord = recordByDate[selectedDate];

  const getCalendarCapacity = (date) => {
    const savedRecord = recordByDate[date];
    if (savedRecord?.capacityBph > 0) return savedRecord.capacityBph;
    if (date === selectedDate && estimated > 0) return estimated;
    return null;
  };

  const roomMembers = useMemo(() => {
    if (!activeRoom) return [];
    return safeRead(`julyang-room-${activeRoom}`, []).sort((a, b) => b.capacity - a.capacity);
  }, [activeRoom, roomTick]);

  useEffect(() => {
    if (!activeRoom || !user) return;
    putMeInRoom(activeRoom, stats.current || estimated || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom, user, stats.current, estimated]);

  const resetDraft = () => {
    setDrinkItems([]);
    setAmount("1");
    setMemo("");
  };

  const changeSelectedDate = (date) => {
    setSelectedDate(date);
    setCalendarMonth(date);
    resetDraft();
  };

  const moveCalendarMonth = (offset) => {
    const base = new Date(`${calendarMonth}T00:00:00`);
    const next = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    setCalendarMonth(formatDateLocal(next));
  };

  const goToday = () => changeSelectedDate(today());

  const handleSignup = () => {
    const name = loginName.trim();
    const password = loginPassword.trim();
    if (!name || !password) {
      setLoginError("이름과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    const users = safeRead("julyang-users", []);
    const duplicated = users.some((savedUser) => savedUser.name === name && savedUser.password === password);
    if (duplicated) {
      setLoginError("이미 등록된 계정이에요. 로그인으로 들어가 주세요.");
      return;
    }

    const newUser = { id: `user_${makeId()}`, name, password, createdAt: new Date().toISOString() };
    safeWrite("julyang-users", [...users, newUser]);

    const currentUser = { id: newUser.id, name: newUser.name };
    setUser(currentUser);
    safeWrite("julyang-current-user", currentUser);
    setLoginPassword("");
    setLoginError("");
  };

  const handleLogin = () => {
    const name = loginName.trim();
    const password = loginPassword.trim();
    if (!name || !password) {
      setLoginError("이름과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    const users = safeRead("julyang-users", []);
    const foundUser = users.find((savedUser) => savedUser.name === name && savedUser.password === password);
    if (!foundUser) {
      setLoginError("등록된 계정을 찾을 수 없어요.");
      return;
    }

    const currentUser = { id: foundUser.id, name: foundUser.name };
    setUser(currentUser);
    safeWrite("julyang-current-user", currentUser);
    setLoginPassword("");
    setLoginError("");
  };

  const handleLogout = () => {
    setUser(null);
    setRecords([]);
    setDrinkItems([]);
    localStorage.removeItem("julyang-current-user");
  };

  const addDrinkItem = () => {
    const value = Number(amount);
    if (!value || value <= 0 || !currentFactor) return;

    const newItem = {
      id: makeId(),
      drinkId,
      drinkName: selectedDrink.name,
      drinkUnit: selectedDrink.unit,
      drinkAbv: isCustomDrink ? Number(customAbv) : selectedDrink.abv,
      customGlassMl: isCustomDrink ? Number(customGlassMl) : null,
      amount: value,
      factor: Number(currentFactor.toFixed(4)),
      sojuAmount: Number(previewSojuAmount.toFixed(3)),
    };

    setDrinkItems((prev) => [...prev, newItem]);
    setAmount("1");
  };

  const removeDrinkItem = (id) => {
    setDrinkItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addRecord = () => {
    if (!estimated || estimated <= 0 || drinkItems.length === 0) return;

    const newRecord = {
      id: makeId(),
      date: selectedDate,
      drinks: drinkItems,
      sojuAmount: Number(totalSojuAmount.toFixed(3)),
      hours: Number(hours),
      stage: Number(stage),
      capacityBph: Number(estimated.toFixed(3)),
      memo,
      createdAt: new Date().toISOString(),
    };

    setRecords((prev) =>
      [...prev.filter((record) => record.date !== selectedDate), newRecord].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
    );
    setMemo("");
  };

  const removeRecord = (id) => {
    setRecords((prev) => prev.filter((record) => record.id !== id));
  };

  const cancelSelectedDateRecord = () => {
    setRecords((prev) => prev.filter((record) => record.date !== selectedDate));
    setMemo("");
  };

  const saveMyRoom = (code) => {
    if (!user || !code) return;
    const room = { code, joinedAt: new Date().toISOString() };
    const next = [room, ...myRooms.filter((savedRoom) => savedRoom.code !== code)];
    setMyRooms(next);
    safeWrite(`julyang-user-rooms-${user.id}`, next);
  };

  const putMeInRoom = (code, capacityValue = null) => {
    if (!user) return;
    const current = capacityValue ?? stats.current ?? estimated ?? 0;
    const saved = safeRead(`julyang-room-${code}`, []);
    const next = [
      ...saved.filter((member) => member.userId !== user.id),
      { userId: user.id, name: user.name, capacity: Number((current || 0).toFixed(3)), updatedAt: new Date().toISOString() },
    ].sort((a, b) => b.capacity - a.capacity);
    safeWrite(`julyang-room-${code}`, next);
    setRoomTick((prev) => prev + 1);
  };

  const openSavedRoom = (code) => {
    setActiveRoom(code);
    setRoomCode(code);
    setRoomError("");
    if (!localStorage.getItem(`julyang-room-${code}`)) safeWrite(`julyang-room-${code}`, []);
    putMeInRoom(code);
    setScreen("room");
  };

  const createRoomCode = () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    if (!localStorage.getItem(`julyang-room-${code}`)) safeWrite(`julyang-room-${code}`, []);
    setActiveRoom(code);
    setRoomCode(code);
    setRoomError("");
    saveMyRoom(code);
    putMeInRoom(code);
    setScreen("room");
  };

  const joinRoom = () => {
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setRoomError("공유 코드를 입력해 주세요.");
      return;
    }
    if (!localStorage.getItem(`julyang-room-${code}`)) safeWrite(`julyang-room-${code}`, []);
    setActiveRoom(code);
    setRoomCode(code);
    setRoomError("");
    saveMyRoom(code);
    putMeInRoom(code);
    setScreen("room");
  };

  const leaveRoom = () => {
    if (!activeRoom || !user) return;

    const savedMembers = safeRead(`julyang-room-${activeRoom}`, []);
    safeWrite(
      `julyang-room-${activeRoom}`,
      savedMembers.filter((member) => member.userId !== user.id)
    );

    const nextRooms = myRooms.filter((room) => room.code !== activeRoom);
    setMyRooms(nextRooms);
    safeWrite(`julyang-user-rooms-${user.id}`, nextRooms);

    setActiveRoom(null);
    setRoomCode("");
    setRoomError("");
    setRoomTick((prev) => prev + 1);
    setScreen("roomHome");
  };

  if (user && screen === "trend") {
    return (
      <main className="page">
        <div className="app-shell">
          <Header title="주량 변화" subtitle="기록이 쌓일수록 변화율이 더 정확해져요." onBack={() => setScreen("main")} />

          <Card>
            <div className="grid two">
              <div className="stat-box">
                <p>하루 주량 변화율</p>
                <strong className={trend.currentRate > 0 ? "up" : trend.currentRate < 0 ? "down" : ""}>
                  {formatPercent(trend.currentRate)}
                </strong>
              </div>
              <div className="stat-box">
                <p>평균 주량 변화율</p>
                <strong className={trend.averageRate > 0 ? "up" : trend.averageRate < 0 ? "down" : ""}>
                  {formatPercent(trend.averageRate)}
                </strong>
              </div>
            </div>

            <div className="soft-panel chart-panel">
              <div className="section-row">
                <h2>변화율 그래프</h2>
                <span>최신 6개 · %</span>
              </div>

              {trendData.length < 2 ? (
                <div className="empty-chart">그래프를 보려면 기록이 2개 이상 필요해요.</div>
              ) : (
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={visibleTrendData} margin={{ top: 12, right: 12, left: -18, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
                      <Tooltip
                        formatter={(value, name) => [
                          `${Number(value).toFixed(1)}%`,
                          name === "dailyRate" ? "하루 변화율" : "평균 변화율",
                        ]}
                      />
                      <Line type="monotone" dataKey="dailyRate" name="하루 변화율" stroke="#fb7185" strokeWidth={3} dot={{ r: 3, fill: "#fb7185" }} />
                      <Line type="monotone" dataKey="averageRate" name="평균 변화율" stroke="#60a5fa" strokeWidth={3} dot={{ r: 3, fill: "#60a5fa" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="legend">
                <span><i className="dot pink" />하루 변화율</span>
                <span><i className="dot blue" />평균 변화율</span>
              </div>
            </div>

            <div className="soft-panel">
              <h2>최근 6개 기록 변화</h2>
              {visibleTrendData.length === 0 ? (
                <p className="empty-small">아직 저장된 기록이 없어요.</p>
              ) : (
                <div className="list">
                  {visibleTrendData.slice().reverse().map((item, index) => (
                    <div className="list-item" key={`${item.date}-${index}`}>
                      <div>
                        <strong>{item.date}</strong>
                        <p>주량 {formatNum(item.capacity)} · 평균 {formatNum(item.average)}</p>
                      </div>
                      <div className="right">
                        <strong className={item.dailyRate > 0 ? "up" : item.dailyRate < 0 ? "down" : ""}>
                          {formatPercent(item.dailyRate)}
                        </strong>
                        <p>하루</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (user && screen === "roomHome") {
    return (
      <main className="page">
        <div className="app-shell">
          <Header title="주량 랭킹" subtitle="내가 들어간 랭킹방을 바로 열 수 있어요." onBack={() => setScreen("main")} />

          <Card>
            <div>
              <h2>내 랭킹방</h2>
              <p className="subtext">한 번 들어간 랭킹방은 여기에 남아요.</p>
            </div>

            {myRooms.length === 0 ? (
              <div className="empty-small">아직 들어간 랭킹방이 없어요.</div>
            ) : (
              <div className="list">
                {myRooms.map((room) => (
                  <button key={room.code} onClick={() => openSavedRoom(room.code)} className="room-card">
                    <div>
                      <p>공유 코드</p>
                      <strong>{room.code}</strong>
                    </div>
                    <span>입장</span>
                  </button>
                ))}
              </div>
            )}

            <div className="divider-section">
              <p>새 랭킹방</p>
              <AppButton onClick={createRoomCode}>방 파기</AppButton>
            </div>

            <div className="divider-section">
              <p>코드로 들어가기</p>
              <div className="input-row">
                <input value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} placeholder="공유 코드" />
                <AppButton onClick={joinRoom} className="small">입장</AppButton>
              </div>
            </div>

            {roomError && <p className="error">{roomError}</p>}
          </Card>
        </div>
      </main>
    );
  }

  if (user && screen === "room") {
    return (
      <main className="page">
        <div className="app-shell">
          <Header title="주량 랭킹" subtitle={`${activeRoom} 랭킹방에 들어와 있어요.`} onBack={() => setScreen("main")} />

          <Card>
            <div className="code-box">
              <p>공유 코드</p>
              <strong>{activeRoom}</strong>
              <span>이 코드를 입력하면 같은 랭킹방으로 들어올 수 있어요.</span>
            </div>

            <div className="grid two">
              <AppButton onClick={() => setRoomTick((prev) => prev + 1)} className="dark">새로고침</AppButton>
              <AppButton onClick={leaveRoom} className="white">랭킹 나가기</AppButton>
            </div>
            <p className="hint">내 주량은 기록이 바뀌면 자동으로 반영돼요.</p>

            {roomError && <p className="error">{roomError}</p>}

            <div className="soft-panel">
              <div className="section-row">
                <h2>주량 순위</h2>
                <span>소주 b/h 기준</span>
              </div>

              {roomMembers.length === 0 ? (
                <p className="empty-small">아직 랭킹방에 아무도 없어요.</p>
              ) : (
                <div className="list">
                  {roomMembers.map((member, index) => (
                    <div className="rank-row" key={member.userId}>
                      <div>
                        <span className="rank-num">{index + 1}</span>
                        <div>
                          <strong>{member.name}</strong>
                          {member.userId === user.id && <p>나</p>}
                        </div>
                      </div>
                      <strong>{formatNum(member.capacity)} 소주 b/h</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Notice text="순위는 재미용 비교입니다. 실제 컨디션과 건강 상태에 따라 반응은 달라질 수 있어요." />
        </div>
      </main>
    );
  }

  if (!user) {
    const isLogin = mode === "login";

    return (
      <main className="page center">
        <div className="app-shell">
          <Card>
            <div className="login-title">
              <div className="icon-badge"><span className="drink-emoji">🍻</span></div>
              <h1>오늘의 주량 체크</h1>
            </div>

            <div className="tabs">
              <button onClick={() => { setMode("login"); setLoginError(""); }} className={isLogin ? "active" : ""}>로그인</button>
              <button onClick={() => { setMode("signup"); setLoginError(""); }} className={!isLogin ? "active" : ""}>회원가입</button>
            </div>

            <label className="field">
              이름
              <div className="field-box">
                <span className="small-icon">👤</span>
                <input value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="예: 은우" />
              </div>
            </label>

            <label className="field">
              비밀번호
              <div className="field-box">
                <span className="small-icon">🔒</span>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (isLogin ? handleLogin() : handleSignup())}
                  placeholder={isLogin ? "비밀번호 입력" : "새 비밀번호 입력"}
                />
              </div>
            </label>

            {loginError && <p className="error">{loginError}</p>}

            <AppButton onClick={isLogin ? handleLogin : handleSignup}>
              {isLogin ? "로그인" : "회원가입"}
            </AppButton>

            <div className="notice-box">회원가입한 이름과 비밀번호로 다시 들어오면 이전 기록이 이어집니다. 지금은 가볍게 쓰는 버전이라 보안용 로그인은 아니에요.</div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="app-shell">
        <header className="main-header">
          <button onClick={() => setScreen("trend")} className="trend-button">
            <p>주량 변화율 <span className={trend.currentRate > 0 ? "up" : trend.currentRate < 0 ? "down" : ""}>{formatPercent(trend.currentRate)}</span></p>
            <p>평균 변화율 <span className={trend.averageRate > 0 ? "up" : trend.averageRate < 0 ? "down" : ""}>{formatPercent(trend.averageRate)}</span></p>
          </button>

          <button onClick={() => setScreen("roomHome")} className="ranking-button">주량 랭킹</button>

          <div className="icon-badge"><span className="drink-emoji">🍻</span></div>
          <h1>오늘의 주량 체크</h1>
          <p>{user.name}님의 주량 기록</p>
          <button onClick={handleLogout} className="text-link">로그아웃</button>
        </header>

        <Card>
          <div className="main-stat-row">
            <div>
              <p>평균 주량</p>
              <strong>{formatNum(stats.avg)}<span> 소주 b/h</span></strong>
            </div>
            <div className="standard-badge">소주 기준<br />1시간당 병 수</div>
          </div>

          <div className="gauge-wrap">
            <svg viewBox="0 0 320 180">
              <path d="M42 150 A118 118 0 0 1 278 150" fill="none" stroke="#f4e7d3" strokeWidth="24" strokeLinecap="round" />
              <path d="M42 150 A118 118 0 0 1 278 150" fill="none" stroke="#f8c9ba" strokeWidth="24" strokeLinecap="round" strokeDasharray={`${ratio * 370} 370`} />
              <circle cx={markerX} cy={markerY} r="13" fill="white" stroke="#fb7185" strokeWidth="7" />
              <text x="42" y="174" textAnchor="middle">최저</text>
              <text x="160" y="94" textAnchor="middle">평균</text>
              <text x="278" y="174" textAnchor="middle">최고</text>
            </svg>
          </div>

          <div className="grid three">
            <div className="mini-stat"><p>최저</p><strong>{formatNum(stats.min)} b/h</strong></div>
            <div className="mini-stat"><p>평균</p><strong>{formatNum(stats.avg)} b/h</strong></div>
            <div className="mini-stat"><p>최고</p><strong>{formatNum(stats.max)} b/h</strong></div>
          </div>
        </Card>

        <Card>
          <div className="title-row">
            <span className="small-icon">+</span>
            <h2>기록 추가</h2>
          </div>

          <label className="field">
            날짜
            <input type="date" value={selectedDate} onChange={(e) => changeSelectedDate(e.target.value)} />
          </label>

          <div className="soft-panel">
            <div className="section-title">
              <h3>술 종류</h3>
              <p>섞어 마신 술은 하나씩 추가해 주세요.</p>
            </div>

            <div className="drink-grid">
              {DRINKS.map((drink) => (
                <button key={drink.id} onClick={() => setDrinkId(drink.id)} className={drinkId === drink.id ? "selected" : ""}>
                  <div>
                    <strong>{drink.name}</strong>
                    <span>{drink.abv ? `${drink.abv}%` : "직접"}</span>
                  </div>
                  <p>{drink.note}</p>
                </button>
              ))}
            </div>

            <div className="grid two">
              <label className="field">마신 양 ({selectedDrink.unit})<input type="number" min="0" step="0.25" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
              <label className="field">마신 시간<input type="number" min="0.25" step="0.25" value={hours} onChange={(e) => setHours(e.target.value)} /></label>
            </div>

            {isCustomDrink && (
              <div className="grid two custom-box">
                <label className="field">도수 (%)<input type="number" min="0" step="0.5" value={customAbv} onChange={(e) => setCustomAbv(e.target.value)} /></label>
                <label className="field">1잔 용량(ml)<input type="number" min="1" step="5" value={customGlassMl} onChange={(e) => setCustomGlassMl(e.target.value)} /></label>
              </div>
            )}

            <div className="soft-result">
              <p>이번 술 소주 환산</p>
              <strong>{formatNum(previewSojuAmount)}병</strong>
              <span>{selectedDrink.name} {amount || 0}{selectedDrink.unit} × 환산계수 {formatNum(currentFactor)}</span>
            </div>

            <AppButton onClick={addDrinkItem}>술 추가하기</AppButton>
          </div>

          <div className="soft-panel">
            <div className="section-row">
              <h3>오늘 마신 술</h3>
              <strong>소주 {formatNum(totalSojuAmount)}병</strong>
            </div>

            {drinkItems.length === 0 ? (
              <p className="empty-small">아직 추가된 술이 없어요.</p>
            ) : (
              <div className="list">
                {drinkItems.map((item) => (
                  <div className="list-item" key={item.id}>
                    <div>
                      <strong>{item.drinkName} {item.amount}{item.drinkUnit}</strong>
                      <p>소주 {formatNum(item.sojuAmount)}병 환산</p>
                    </div>
                    <button onClick={() => removeDrinkItem(item.id)} className="icon-delete"><span className="small-icon">✕</span></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="soft-panel">
            <div className="section-title">
              <h3>취한 정도</h3>
              <p>그날의 최종 상태에 가장 가까운 걸 골라 주세요.</p>
            </div>

            <div className="stage-list">
              {STAGES.map((item) => (
                <button key={item.id} onClick={() => setStage(item.id)} className={Number(stage) === item.id ? "selected" : ""}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>× {item.id}</span>
                  </div>
                  <p>{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            메모
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 안주 많이 먹음, 컨디션 별로였음" />
          </label>

          <div className="result-box">
            <p>이번 기록으로 계산한 주량</p>
            <strong>{formatNum(estimated)} 소주 b/h</strong>
            <span>총 소주 환산량 ÷ 시간 ÷ 취한 정도</span>
          </div>

          <div className="grid two">
            <AppButton onClick={addRecord}>이 날짜에 저장</AppButton>
            <AppButton onClick={cancelSelectedDateRecord} disabled={!selectedRecord} className="white">기록 취소</AppButton>
          </div>
        </Card>

        <Card>
          <div className="calendar-head">
            <div>
              <span className="small-icon">📅</span>
              <h2>캘린더</h2>
            </div>
            <button onClick={goToday}>오늘</button>
          </div>

          <div className="month-nav">
            <button onClick={() => moveCalendarMonth(-1)}>이전</button>
            <strong>{year}.{String(month + 1).padStart(2, "0")}</strong>
            <button onClick={() => moveCalendarMonth(1)}>다음</button>
          </div>

          <div className="weekdays">
            {["일", "월", "화", "수", "목", "금", "토"].map((dayName) => <div key={dayName}>{dayName}</div>)}
          </div>

          <div className="calendar-grid">
            {days.map((day, index) => {
              if (!day) return <div key={`blank-${index}`} />;
              const date = formatDateLocal(day);
              const calendarCapacity = getCalendarCapacity(date);
              const isSelected = date === selectedDate;
              const hasCapacity = calendarCapacity !== null;

              return (
                <button key={date} onClick={() => changeSelectedDate(date)} className={`${isSelected ? "selected" : ""} ${hasCapacity ? "has-capacity" : ""}`}>
                  <span>{day.getDate()}</span>
                  {hasCapacity && <em>{formatNum(calendarCapacity)}</em>}
                </button>
              );
            })}
          </div>

          {selectedRecord && (
            <div className="record-detail">
              <div>
                <strong>{selectedRecord.date} 기록</strong>
                <p>총 소주 {formatNum(selectedRecord.sojuAmount)}병 환산</p>
                {selectedRecord.drinks?.length > 0 && (
                  <p>{selectedRecord.drinks.map((drink) => `${drink.drinkName} ${drink.amount}${drink.drinkUnit}`).join(" · ")}</p>
                )}
                <p>{selectedRecord.hours}시간 · {formatNum(selectedRecord.capacityBph)} 소주 b/h</p>
                {selectedRecord.memo && <p>{selectedRecord.memo}</p>}
              </div>
              <button onClick={() => removeRecord(selectedRecord.id)} className="icon-delete"><span className="small-icon">✕</span></button>
            </div>
          )}
        </Card>

        <Notice text="이건 음주를 권하는 앱이 아니라 내 상태를 기록하는 용도예요. 컨디션, 수면, 음식, 약 복용 여부에 따라 실제 반응은 달라질 수 있습니다." />
      </div>
    </main>
  );
}

function Header({ title, subtitle, onBack }) {
  return (
    <header className="simple-header">
      <div className="icon-badge"><span className="drink-emoji">🍻</span></div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <button onClick={onBack} className="text-link">내 기록으로 돌아가기</button>
    </header>
  );
}

function Notice({ text }) {
  return (
    <div className="notice-line">
      <span className="small-icon">!</span>
      <p>{text}</p>
    </div>
  );
}
